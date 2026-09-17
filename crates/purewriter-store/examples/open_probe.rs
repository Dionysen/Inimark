//! Probe opening a Pure Writer library from the CLI.
use std::env;
use purewriter_store::Library;

fn main() {
    let root = env::args().nth(1).expect("usage: open_probe <library-root>");
    match Library::open(&root) {
        Ok(lib) => {
            println!("ok root={}", lib.root().display());
            println!("writes={}", lib.writes_allowed());
            let folders = lib.list_folders(false).unwrap();
            println!("folders={}", folders.len());
            for f in &folders {
                let arts = lib.list_articles(Some(&f.id), None, false).unwrap();
                println!("  {} ({}) articles={}", f.id, f.name, arts.len());
            }
        }
        Err(e) => {
            eprintln!("ERR code={} msg={}", e.code(), e);
            std::process::exit(1);
        }
    }
}
