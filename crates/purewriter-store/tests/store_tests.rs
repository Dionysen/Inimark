mod common;

use purewriter_store::{
    export_pwb, unpack_pwb, CreateArticle, CreateCategory, CreateFolder, Error, Library,
    UpdateArticle,
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
