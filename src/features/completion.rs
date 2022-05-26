use std::{
    fs::{read_dir, DirEntry, ReadDir},
    io::Error,
    path::Path,
};

use tower_lsp::{
    lsp_types::{
        CompletionItem, CompletionItemKind, CompletionParams, CompletionResponse, MessageType,
    },
    Client,
};

use crate::workspace::Workspace;

#[derive(Default)]
pub struct CompletionModule {}

impl CompletionModule {
    fn completion_item_for_path(
        path: Result<DirEntry, Error>,
        current_completed_file_name: String,
    ) -> Option<CompletionItem> {
        let path = match path {
            Ok(path) => path,
            Err(_) => return None,
        };

        let file_name = path.file_name();
        let file_name = match file_name.to_str() {
            Some(file_name) => file_name,
            None => return None,
        };

        if current_completed_file_name.starts_with(".") && !file_name.starts_with(".") {
            return None;
        }

        let kind = if path.path().is_dir() {
            CompletionItemKind::FOLDER
        } else {
            CompletionItemKind::FILE
        };

        let label = file_name.to_string();
        let insert_text = match current_completed_file_name.find(".") {
            Some(last_dot_index) => label[(last_dot_index + 1)..].to_string(),
            None => label.clone(),
        };

        Some(CompletionItem {
            label,
            detail: Some(path.path().display().to_string()),
            kind: Some(kind),
            insert_text: Some(insert_text),
            ..Default::default()
        })
    }

    fn completion_items_for_paths(
        paths: ReadDir,
        current_completed_file_name: String,
    ) -> CompletionResponse {
        let mut items: Vec<CompletionItem> = Vec::new();
        for path in paths {
            match Self::completion_item_for_path(path, current_completed_file_name.clone()) {
                Some(item) => items.push(item),
                None => continue,
            }
        }
        CompletionResponse::Array(items)
    }

    pub async fn get_response(
        &self,
        params: CompletionParams,
        workspace: &Workspace,
        client: &Client,
    ) -> Option<CompletionResponse> {
        // Get gitignore file
        let gitignore_file_uri = &params.text_document_position.text_document.uri;
        let gitignore_file = workspace.files.get(&gitignore_file_uri.to_string());
        let gitignore_file = match gitignore_file {
            Some(file) => file,
            None => {
                let error = format!(
                    "The file {url} is not opened on the server.",
                    url = gitignore_file_uri.to_string()
                );
                client.log_message(MessageType::ERROR, error).await;
                return None;
            }
        };
        let gitignore_file = &gitignore_file.value();

        // Get currently typed path
        let line_content =
            gitignore_file.get_line_content(params.text_document_position.position.line);
        let line_content = line_content.trim();
        let path = Path::new(line_content);
        let relative_path = if !line_content.ends_with("/") {
            path.parent().unwrap_or(path)
        } else {
            path
        };

        // Get C:/Users/me/folder/.gitignore
        let gitignore_path = gitignore_file.path();
        // Get C:/Users/me/folder
        let gitignore_path = Path::new(&gitignore_path).parent()?;
        let path_string = path.to_str()?;

        // Get currently typed filename
        let (_, file_name) = path_string.rsplit_once("/").unwrap_or(("", line_content));
        let file_name = file_name.to_string();

        // Join path
        let complete_path = Path::join(gitignore_path, relative_path);

        // Search for files
        let paths = match read_dir(complete_path) {
            Ok(paths) => paths,
            Err(error) => {
                client.log_message(MessageType::ERROR, error).await;
                return None;
            }
        };

        // Return items
        Some(Self::completion_items_for_paths(paths, file_name))
    }
}
