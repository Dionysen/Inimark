mod common;

use purewriter_store::{
    export_pwb, merge_db_into_library, unpack_pwb, CreateArticle, CreateCategory, CreateFolder,
    Error, Library, UpdateArticle, UpdateFolder,
};

use common::FixtureLib;

#[test]
fn open_lists_seed_folders() {
    let fx = FixtureLib::create(false);
    let lib = Library::open(fx.path()).unwrap();
    assert!(lib.writes_allowed());
    let folders = lib.list_folders(false).unwrap();
    assert_eq!(folders.len(), 2);
    assert!(folders.iter().any(|f| f.id == "Default"));
    assert!(folders.iter().any(|f| f.id == "PW_Trash"));
}

#[test]
fn schema_mismatch_is_readonly_without_override() {
    let fx = FixtureLib::create(true);
    let mut lib = Library::open(fx.path()).unwrap();
    assert!(!lib.writes_allowed());
    let err = lib
        .create_folder(CreateFolder {
            name: "x".into(),
            ..Default::default()
        })
        .unwrap_err();
    assert!(matches!(err, Error::ReadOnlySchema));
}

#[test]
fn schema_override_allow_write_on_mismatch() {
    let fx = FixtureLib::create(true);
    fx.write_override(
        r#"{ "schemaOverride": { "allowWriteOnMismatch": true, "acceptedFingerprints": [] } }"#,
    );
    let mut lib = Library::open(fx.path()).unwrap();
    assert!(lib.writes_allowed());
    let folder = lib
        .create_folder(CreateFolder {
            name: "Notes".into(),
            ..Default::default()
        })
        .unwrap();
    assert_eq!(folder.name, "Notes");
}

#[test]
fn schema_override_accepted_fingerprint() {
    let fx = FixtureLib::create(true);
    fx.write_override(
        r#"{
          "schemaOverride": {
            "allowWriteOnMismatch": false,
            "acceptedFingerprints": [
              { "userVersion": 27, "identityHash": "deadbeefdeadbeefdeadbeefdeadbeef" }
            ]
          }
        }"#,
    );
    let lib = Library::open(fx.path()).unwrap();
    assert!(lib.writes_allowed());
}

#[test]
fn article_crud_updates_timestamps() {
    let fx = FixtureLib::create(false);
    let mut lib = Library::open(fx.path()).unwrap();
    let cat = lib
        .create_category(CreateCategory {
            folder_id: "Default".into(),
            name: "Ch1".into(),
            ..Default::default()
        })
        .unwrap();
    let art = lib
        .create_article(CreateArticle {
            title: "Hello".into(),
            content: "你好世界\n第二行".into(),
            folder_id: "Default".into(),
            category_id: Some(cat.id.clone()),
            extension: Some("txt".into()),
        })
        .unwrap();
    assert!(art.count.unwrap_or(0) > 0);
    assert!(art.summary.as_ref().unwrap().contains("你好"));
    assert!(art.order_key.is_some());

    let before = art.update_time;
    std::thread::sleep(std::time::Duration::from_millis(2));
    let updated = lib
        .update_article(
            &art.id,
            UpdateArticle {
                content: Some("新内容".into()),
                ..Default::default()
            },
        )
        .unwrap();
    assert!(updated.update_time >= before);
    assert_eq!(updated.content, "新内容");

    let trashed = lib.trash_article(&art.id).unwrap();
    assert_eq!(trashed.folder_id, "PW_Trash");
    assert_eq!(trashed.deleted, 0);

    let kept = lib
        .create_article(CreateArticle {
            title: "留着".into(),
            content: "正文".into(),
            folder_id: "Default".into(),
            category_id: None,
            extension: Some("txt".into()),
        })
        .unwrap();
    let refused = lib.purge_trashed_article(&kept.id).unwrap_err();
    assert!(matches!(refused, Error::Other(_)));
    assert!(lib.get_article(&kept.id).is_ok());

    lib.purge_trashed_article(&art.id).unwrap();
    assert!(matches!(
        lib.get_article(&art.id).unwrap_err(),
        Error::NotFound(_)
    ));
}

#[test]
fn delete_category_moves_chapters_to_uncategorized() {
    let fx = FixtureLib::create(false);
    let mut lib = Library::open(fx.path()).unwrap();
    let cat = lib
        .create_category(CreateCategory {
            folder_id: "Default".into(),
            name: "卷一".into(),
            ..Default::default()
        })
        .unwrap();
    let art = lib
        .create_article(CreateArticle {
            title: "章".into(),
            content: "正文".into(),
            folder_id: "Default".into(),
            category_id: Some(cat.id.clone()),
            extension: Some("txt".into()),
        })
        .unwrap();

    lib.soft_delete_category(&cat.id).unwrap();

    let categories = lib.list_categories(Some("Default"), false).unwrap();
    assert!(categories.iter().all(|item| item.id != cat.id));
    let listed = lib
        .list_articles(Some("Default"), None, false)
        .unwrap()
        .into_iter()
        .find(|item| item.id == art.id)
        .unwrap();
    assert!(listed.category_id.is_none());
}

#[test]
fn lock_rejects_second_open() {
    let fx = FixtureLib::create(false);
    let _lib = Library::open(fx.path()).unwrap();
    match Library::open(fx.path()) {
        Err(Error::Locked(_)) => {}
        Ok(_) => panic!("expected Locked"),
        Err(e) => panic!("unexpected error: {e}"),
    }
}

#[test]
fn settings_shortcuts_daily_history_sidecars() {
    let fx = FixtureLib::create(false);
    let mut lib = Library::open(fx.path()).unwrap();

    lib.set_setting("selected_folder_id", "Default").unwrap();
    assert_eq!(
        lib.get_setting("selected_folder_id")
            .unwrap()
            .unwrap()
            .value,
        "Default"
    );

    let sc = lib
        .upsert_shortcut_text("indent", "\u{3000}\u{3000}", 1)
        .unwrap();
    assert_eq!(sc.title, "indent");
    assert_eq!(lib.list_shortcuts(false).unwrap().len(), 1);

    let art = lib
        .create_article(CreateArticle {
            title: "d".into(),
            content: "abc".into(),
            folder_id: "Default".into(),
            ..Default::default()
        })
        .unwrap();
    lib.record_daily(2026, 9, 17, &art.id, "d", "Default", "Default", 3, 10, 20)
        .unwrap();
    assert_eq!(lib.list_daily(10).unwrap().len(), 1);

    lib.snapshot_article_history(&art.id).unwrap();
    assert_eq!(lib.list_article_history(&art.id, 10).unwrap().len(), 1);

    let mut scrolls = lib.read_scrolls().unwrap();
    scrolls.insert(
        art.id.clone(),
        purewriter_store::ScrollEntry {
            scroll: 12,
            time: 99,
        },
    );
    lib.write_scrolls(&scrolls).unwrap();
    assert_eq!(lib.read_scrolls().unwrap()[&art.id].scroll, 12);

    lib.write_tab_article_ids(&[art.id.clone()]).unwrap();
    assert_eq!(lib.read_tab_article_ids().unwrap(), vec![art.id.clone()]);

    lib.write_folder_view_state("Default", "PW_FOLDER_VIEW_STATE_V1\n").unwrap();
    assert!(lib
        .read_folder_view_state("Default")
        .unwrap()
        .unwrap()
        .contains("PW_FOLDER_VIEW_STATE_V1"));
}

#[test]
fn pwb_round_trip() {
    let fx = FixtureLib::create(false);
    {
        let mut lib = Library::open(fx.path()).unwrap();
        lib.create_article(CreateArticle {
            title: "t".into(),
            content: "body".into(),
            folder_id: "Default".into(),
            ..Default::default()
        })
        .unwrap();
    }
    // lock released
    let pwb = fx.root.join("out.pwb");
    export_pwb(&fx.room_path(), &pwb, "backup.db").unwrap();
    let unpack = fx.root.join("unpacked");
    let result = unpack_pwb(&pwb, &unpack).unwrap();
    assert!(result.db_path.is_file());
    assert_eq!(result.md5v2.len(), 32);

    // import replace via library
    let lib = Library::open(fx.path()).unwrap();
    let backup = lib.import_pwb_replace(&pwb).unwrap();
    assert!(backup.is_file());
    let lib = Library::open(fx.path()).unwrap();
    assert_eq!(lib.list_articles(None, None, false).unwrap().len(), 1);
}

#[test]
fn merge_articles_lww_by_update_time() {
    use rusqlite::Connection;

    let dest_fx = FixtureLib::create(false);
    let src_fx = FixtureLib::create(false);

    let article_id = {
        let mut dest = Library::open(dest_fx.path()).unwrap();
        let art = dest
            .create_article(CreateArticle {
                title: "old-title".into(),
                content: "old-body".into(),
                folder_id: "Default".into(),
                ..Default::default()
            })
            .unwrap();
        art.id
    };
    {
        let dest_db = Connection::open(dest_fx.room_path()).unwrap();
        dest_db
            .execute(
                "UPDATE Article SET updateTime = 100, titleUpdateTime = 100 WHERE id = ?1",
                [&article_id],
            )
            .unwrap();
    }

    {
        let src_db = Connection::open(src_fx.room_path()).unwrap();
        src_db
            .execute(
                "INSERT INTO Article (
                  id, title, content, summary, count, extension, preview, preview1,
                  updateTime, createTime, folderId, categoryId, editorId, rank,
                  titleUpdateTime, rankUpdateTime, folderIdUpdateTime, categoryIdUpdateTime, extensionUpdateTime,
                  deleted, deletedTime, autoChapter, autoChapterUpdateTime, orderKey, structureUpdateTime
                ) VALUES (?1, 'new-title', 'new-body', 'new', 8, 'txt', 0, 0,
                  500, 1, 'Default', NULL, 0, 0, 500, 0, 0, 0, 0, 0, 0, 0, 0, NULL, 0)",
                [&article_id],
            )
            .unwrap();
    }

    let dest = Library::open(dest_fx.path()).unwrap();
    let report = merge_db_into_library(&dest, &src_fx.room_path()).unwrap();
    assert!(report.changed);
    assert!(report.articles_upserted >= 1);
    let merged = dest.get_article(&article_id).unwrap();
    assert_eq!(merged.content, "new-body");
    assert_eq!(merged.title, "new-title");
}

#[test]
fn merge_respects_newer_tombstone() {
    use rusqlite::Connection;

    let dest_fx = FixtureLib::create(false);
    let src_fx = FixtureLib::create(false);

    let article_id = {
        let mut dest = Library::open(dest_fx.path()).unwrap();
        let art = dest
            .create_article(CreateArticle {
                title: "alive".into(),
                content: "x".into(),
                folder_id: "Default".into(),
                ..Default::default()
            })
            .unwrap();
        art.id
    };
    {
        let dest_db = Connection::open(dest_fx.room_path()).unwrap();
        dest_db
            .execute(
                "UPDATE Article SET updateTime = 100, deleted = 0, deletedTime = 0 WHERE id = ?1",
                [&article_id],
            )
            .unwrap();
    }

    {
        let src_db = Connection::open(src_fx.room_path()).unwrap();
        src_db
            .execute(
                "INSERT INTO Article (
                  id, title, content, summary, count, extension, preview, preview1,
                  updateTime, createTime, folderId, categoryId, editorId, rank,
                  titleUpdateTime, rankUpdateTime, folderIdUpdateTime, categoryIdUpdateTime, extensionUpdateTime,
                  deleted, deletedTime, autoChapter, autoChapterUpdateTime, orderKey, structureUpdateTime
                ) VALUES (?1, 'alive', 'x', 'x', 1, 'txt', 0, 0,
                  100, 1, 'Default', NULL, 0, 0, 100, 0, 0, 0, 0, 1, 900, 0, 0, NULL, 0)",
                [&article_id],
            )
            .unwrap();
    }

    let dest = Library::open(dest_fx.path()).unwrap();
    merge_db_into_library(&dest, &src_fx.room_path()).unwrap();
    let merged = dest.get_article(&article_id).unwrap();
    assert_eq!(merged.deleted, 1);
    assert_eq!(merged.deleted_time, 900);
}

#[test]
fn update_folder_sets_and_clears_tags() {
    let fx = FixtureLib::create(false);
    let mut lib = Library::open(fx.path()).unwrap();
    let updated = lib
        .update_folder(
            "Default",
            UpdateFolder {
                name: Some("新书名".into()),
                tags: Some(Some("长篇".into())),
                ..Default::default()
            },
        )
        .unwrap();
    assert_eq!(updated.name, "新书名");
    assert_eq!(updated.tags.as_deref(), Some("长篇"));

    let cleared = lib
        .update_folder(
            "Default",
            UpdateFolder {
                tags: Some(None),
                ..Default::default()
            },
        )
        .unwrap();
    assert_eq!(cleared.name, "新书名");
    assert!(cleared.tags.is_none());

    let blank = lib
        .update_folder(
            "Default",
            UpdateFolder {
                tags: Some(Some("   ".into())),
                ..Default::default()
            },
        )
        .unwrap();
    assert!(blank.tags.is_none());

    let err = lib
        .update_folder(
            "Default",
            UpdateFolder {
                name: Some("  ".into()),
                ..Default::default()
            },
        )
        .unwrap_err();
    assert!(matches!(err, Error::Other(_)));
    assert_eq!(lib.get_folder("Default").unwrap().name, "新书名");
}
