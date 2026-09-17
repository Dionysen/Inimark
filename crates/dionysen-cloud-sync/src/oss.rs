//! Minimal Aliyun OSS REST client (OSS4-HMAC-SHA256) for list/get/put/delete/head.

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::error::{Error, Result};
use crate::vault::OssRecord;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OssObjectSummary {
    pub key: String,
    pub size: u64,
    pub last_modified: Option<String>,
    pub etag: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OssObjectMeta {
    pub key: String,
    pub size: Option<u64>,
    pub content_type: Option<String>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OssConfigPublic {
    pub endpoint: String,
    pub bucket: String,
    pub access_key_id: String,
    pub prefix: String,
}

impl From<&OssRecord> for OssConfigPublic {
    fn from(value: &OssRecord) -> Self {
        Self {
            endpoint: value.endpoint.clone(),
            bucket: value.bucket.clone(),
            access_key_id: value.access_key_id.clone(),
            prefix: value.prefix.clone(),
        }
    }
}

pub struct OssClient {
    record: OssRecord,
    region: String,
}

impl OssClient {
    pub fn new(record: OssRecord) -> Result<Self> {
        let region = infer_region(&record.endpoint)?;
        Ok(Self { record, region })
    }

    pub fn list_objects(
        &self,
        prefix: Option<&str>,
        marker: Option<&str>,
        max_keys: Option<u32>,
    ) -> Result<Vec<OssObjectSummary>> {
        let mut query = BTreeMap::new();
        let effective_prefix = join_prefix(&self.record.prefix, prefix.unwrap_or(""));
        if !effective_prefix.is_empty() {
            query.insert("prefix".into(), effective_prefix);
        }
        if let Some(m) = marker {
            query.insert("marker".into(), m.to_string());
        }
        query.insert(
            "max-keys".into(),
            max_keys.unwrap_or(100).clamp(1, 1000).to_string(),
        );

        let (status, _headers, body) =
            self.signed_request("GET", "/", &query, None, None)?;
        if !(200..300).contains(&status) {
            return Err(Error::Oss(format!(
                "list failed ({status}): {}",
                String::from_utf8_lossy(&body)
            )));
        }
        parse_list_bucket_xml(&String::from_utf8_lossy(&body))
    }

    pub fn get_object(&self, key: &str) -> Result<Vec<u8>> {
        let object_key = join_prefix(&self.record.prefix, key);
        let path = format!("/{}", trim_leading_slash(&object_key));
        let (status, _headers, bytes) =
            self.signed_request("GET", &path, &BTreeMap::new(), None, None)?;
        if !(200..300).contains(&status) {
            return Err(Error::Oss(format!(
                "get failed ({status}): {}",
                String::from_utf8_lossy(&bytes)
            )));
        }
        Ok(bytes)
    }

    pub fn put_object(
        &self,
        key: &str,
        data: &[u8],
        content_type: Option<&str>,
    ) -> Result<()> {
        let object_key = join_prefix(&self.record.prefix, key);
        let path = format!("/{}", trim_leading_slash(&object_key));
        let ct = content_type.unwrap_or("application/octet-stream");
        let (status, _headers, bytes) =
            self.signed_request("PUT", &path, &BTreeMap::new(), Some(data), Some(ct))?;
        if !(200..300).contains(&status) {
            return Err(Error::Oss(format!(
                "put failed ({status}): {}",
                String::from_utf8_lossy(&bytes)
            )));
        }
        Ok(())
    }

    pub fn delete_object(&self, key: &str) -> Result<()> {
        let object_key = join_prefix(&self.record.prefix, key);
        let path = format!("/{}", trim_leading_slash(&object_key));
        let (status, _headers, bytes) =
            self.signed_request("DELETE", &path, &BTreeMap::new(), None, None)?;
        if !(200..300).contains(&status) {
            return Err(Error::Oss(format!(
                "delete failed ({status}): {}",
                String::from_utf8_lossy(&bytes)
            )));
        }
        Ok(())
    }

    pub fn head_object(&self, key: &str) -> Result<OssObjectMeta> {
        let object_key = join_prefix(&self.record.prefix, key);
        let path = format!("/{}", trim_leading_slash(&object_key));
        let (status, headers, bytes) =
            self.signed_request("HEAD", &path, &BTreeMap::new(), None, None)?;
        if !(200..300).contains(&status) {
            return Err(Error::Oss(format!(
                "head failed ({status}): {}",
                String::from_utf8_lossy(&bytes)
            )));
        }
        Ok(OssObjectMeta {
            key: object_key,
            size: headers
                .get("content-length")
                .and_then(|v| v.parse().ok()),
            content_type: headers.get("content-type").cloned(),
            etag: headers.get("etag").cloned(),
            last_modified: headers.get("last-modified").cloned(),
        })
    }

    fn signed_request(
        &self,
        method: &str,
        canonical_uri: &str,
        query: &BTreeMap<String, String>,
        body: Option<&[u8]>,
        content_type: Option<&str>,
    ) -> Result<(u16, BTreeMap<String, String>, Vec<u8>)> {
        let host = format!(
            "{}.{}",
            self.record.bucket,
            strip_scheme(&self.record.endpoint)
        );
        let payload = body.unwrap_or(b"");
        let payload_hash = hex::encode(Sha256::digest(payload));
        let now: DateTime<Utc> = Utc::now();
        let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
        let date_stamp = now.format("%Y%m%d").to_string();

        let mut headers = BTreeMap::new();
        headers.insert("host".to_string(), host.clone());
        headers.insert("x-oss-content-sha256".to_string(), payload_hash.clone());
        headers.insert("x-oss-date".to_string(), amz_date.clone());
        if let Some(ct) = content_type {
            headers.insert("content-type".to_string(), ct.to_string());
        }

        let signed_header_names: Vec<String> = headers.keys().cloned().collect();
        let signed_headers = signed_header_names.join(";");
        let canonical_headers = headers
            .iter()
            .map(|(k, v)| format!("{k}:{}\n", v.trim()))
            .collect::<String>();
        let canonical_query = canonical_query_string(query);
        let canonical_request = format!(
            "{method}\n{canonical_uri}\n{canonical_query}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
        );
        let credential_scope = format!("{date_stamp}/{}/oss/aliyun_v4_request", self.region);
        let string_to_sign = format!(
            "OSS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{}",
            hex::encode(Sha256::digest(canonical_request.as_bytes()))
        );
        let signing_key =
            oss4_signing_key(&self.record.access_key_secret, &date_stamp, &self.region)?;
        let signature = hex::encode(hmac_sha256(&signing_key, string_to_sign.as_bytes())?);
        let authorization = format!(
            "OSS4-HMAC-SHA256 Credential={}/{credential_scope},AdditionalHeaders={signed_headers},Signature={signature}",
            self.record.access_key_id
        );

        let url = format!(
            "https://{}{}{}",
            host,
            canonical_uri,
            if canonical_query.is_empty() {
                String::new()
            } else {
                format!("?{canonical_query}")
            }
        );

        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| Error::Http(e.to_string()))?;

        let mut builder = match method {
            "GET" => client.get(&url),
            "PUT" => client.put(&url),
            "DELETE" => client.delete(&url),
            "HEAD" => client.head(&url),
            other => return Err(Error::Oss(format!("unsupported method {other}"))),
        };
        builder = builder.header("Authorization", authorization);
        for (k, v) in &headers {
            if k == "host" {
                continue;
            }
            builder = builder.header(k, v);
        }
        if let Some(data) = body {
            builder = builder.body(data.to_vec());
        }

        let resp = builder.send().map_err(|e| Error::Http(e.to_string()))?;
        let status = resp.status().as_u16();
        let mut resp_headers = BTreeMap::new();
        for (k, v) in resp.headers().iter() {
            if let Ok(val) = v.to_str() {
                resp_headers.insert(k.as_str().to_ascii_lowercase(), val.to_string());
            }
        }
        let bytes = resp
            .bytes()
            .map_err(|e| Error::Http(e.to_string()))?
            .to_vec();
        Ok((status, resp_headers, bytes))
    }
}

fn oss4_signing_key(secret: &str, date: &str, region: &str) -> Result<Vec<u8>> {
    let k_date = hmac_sha256(format!("aliyun_v4{secret}").as_bytes(), date.as_bytes())?;
    let k_region = hmac_sha256(&k_date, region.as_bytes())?;
    let k_service = hmac_sha256(&k_region, b"oss")?;
    hmac_sha256(&k_service, b"aliyun_v4_request")
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Result<Vec<u8>> {
    let mut mac = HmacSha256::new_from_slice(key).map_err(|e| Error::Crypto(e.to_string()))?;
    mac.update(data);
    Ok(mac.finalize().into_bytes().to_vec())
}

fn canonical_query_string(query: &BTreeMap<String, String>) -> String {
    query
        .iter()
        .map(|(k, v)| format!("{}={}", uri_encode(k), uri_encode(v)))
        .collect::<Vec<_>>()
        .join("&")
}

fn uri_encode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn strip_scheme(endpoint: &str) -> String {
    endpoint
        .trim()
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_end_matches('/')
        .to_string()
}

fn infer_region(endpoint: &str) -> Result<String> {
    let host = strip_scheme(endpoint);
    if let Some(rest) = host.strip_prefix("oss-") {
        let region = rest.split('.').next().unwrap_or("cn-hangzhou");
        return Ok(region.to_string());
    }
    Ok("cn-hangzhou".into())
}

fn join_prefix(prefix: &str, key: &str) -> String {
    let p = prefix.trim().trim_matches('/');
    let k = key.trim().trim_start_matches('/');
    match (p.is_empty(), k.is_empty()) {
        (true, true) => String::new(),
        (true, false) => k.to_string(),
        (false, true) => format!("{p}/"),
        (false, false) => format!("{p}/{k}"),
    }
}

fn trim_leading_slash(s: &str) -> &str {
    s.trim_start_matches('/')
}

fn parse_list_bucket_xml(xml: &str) -> Result<Vec<OssObjectSummary>> {
    let mut out = Vec::new();
    for chunk in xml.split("<Contents>").skip(1) {
        let end = chunk.find("</Contents>").unwrap_or(chunk.len());
        let block = &chunk[..end];
        let key = xml_tag(block, "Key").unwrap_or_default();
        if key.is_empty() {
            continue;
        }
        let size = xml_tag(block, "Size")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        out.push(OssObjectSummary {
            key,
            size,
            last_modified: xml_tag(block, "LastModified"),
            etag: xml_tag(block, "ETag"),
        });
    }
    Ok(out)
}

fn xml_tag(block: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = block.find(&open)? + open.len();
    let end = block[start..].find(&close)? + start;
    Some(block[start..end].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn join_prefix_cases() {
        assert_eq!(join_prefix("vellum/", "a.txt"), "vellum/a.txt");
        assert_eq!(join_prefix("", "a.txt"), "a.txt");
        assert_eq!(join_prefix("vellum", ""), "vellum/");
    }

    #[test]
    fn infer_region_from_endpoint() {
        assert_eq!(
            infer_region("https://oss-cn-beijing.aliyuncs.com").unwrap(),
            "cn-beijing"
        );
    }

    #[test]
    fn parse_list_xml() {
        let xml = r#"<?xml version="1.0"?>
<ListBucketResult>
  <Contents><Key>a.txt</Key><Size>3</Size><LastModified>2024-01-01T00:00:00.000Z</LastModified><ETag>"abc"</ETag></Contents>
  <Contents><Key>b.txt</Key><Size>4</Size></Contents>
</ListBucketResult>"#;
        let items = parse_list_bucket_xml(xml).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].key, "a.txt");
        assert_eq!(items[0].size, 3);
    }
}
