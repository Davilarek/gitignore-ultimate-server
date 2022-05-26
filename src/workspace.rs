use dashmap::DashMap;
use tower_lsp::{
    lsp_types::{
        DidChangeTextDocumentParams, DidCloseTextDocumentParams, DidOpenTextDocumentParams,
        MessageType, Url,
    },
    Client,
};

use crate::file::File;

pub struct Workspace {
    pub files: DashMap<String, File>,
}

impl Workspace {
    pub fn add_file(&self, file: File) {
        self.files.insert(file.url.to_string(), file);
    }

    pub fn remove_file(&self, url: Url) {
        self.files.remove(&url.to_string());
    }
}

impl Workspace {
    pub fn new() -> Self {
        Workspace {
            files: DashMap::new(),
        }
    }

    pub fn open(&self, params: DidOpenTextDocumentParams) {
        let url = params.text_document.uri;
        let text = params.text_document.text;

        let file = File::new(url, text);
        self.add_file(file);
    }

    pub fn close(&self, params: DidCloseTextDocumentParams) {
        self.remove_file(params.text_document.uri);
    }

    pub async fn apply_changes(&self, params: DidChangeTextDocumentParams, client: &Client) {
        let mut file = match self.files.get_mut(&params.text_document.uri.to_string()) {
            Some(file) => (file),
            None => {
                let error = format!(
                    "The file {url} is not opened on the server.",
                    url = params.text_document.uri.to_string()
                );
                client.log_message(MessageType::ERROR, error).await;
                return;
            }
        };

        for change in params.content_changes {
            file.apply_change(change)
        }
    }
}