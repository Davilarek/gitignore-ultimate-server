const fs = require('fs');
const path = require('path');
const { CompletionItemKind, CompletionItem, Position, WorkspaceFolder } = require("vscode-languageserver");

class CompletionModule {
    static completionItemForPath(pathResult, currentCompletedFileName, searchPath) {
        // if (pathResult.isErr()) return null;
        try {
            const pathRes = pathResult;
            const fileName = pathRes.name;
            if (!fileName) return null;

            if (currentCompletedFileName.startsWith(".") && !fileName.startsWith(".")) {
                return null;
            }

            const kind = pathRes.isDirectory() ? CompletionItemKind.Folder : CompletionItemKind.File;

            const label = fileName;
            const insertText = currentCompletedFileName.includes(".") ? label.substring(label.lastIndexOf(".") + 1) : label;

            return {
                label,
                detail: path.join(searchPath, pathRes.name),
                kind,
                insertText,
                // ...CompletionItem.create(label)
            };
        } catch (error) {
            console.error(error);
        }
    }

    static completionItemsForPaths(paths, currentCompletedFileName, searchPath) {
        const items = [];

        for (const pathResult of paths) {
            const item = CompletionModule.completionItemForPath(pathResult, currentCompletedFileName, searchPath);
            if (item) {
                items.push(item);
            }
        }

        return items;
    }

    /**
     * 
     * @param {Position} params 
     * @param {string} uri 
     * @param {WorkspaceFolder[]} workspaceFolders
     * @returns 
     */
    getCompletion(params, uri, workspaceFolders, cachedState) {
        const position = params;

        const gitignoreFile = workspaceFolders.filter(x => x.uri == uri)[0];
        if (!gitignoreFile) {
            // return Promise.reject(`The file ${uri} is not opened on the server.`);
            throw new Error(`The file ${uri} is not opened on the server.`);
        }
        const gitignoreGood = decodeURIComponent(path.normalize(require("url").parse(gitignoreFile.uri).pathname).slice(1));
        // let lineContent = fs.readFileSync(gitignoreGood, 'utf8').replace(/\r/g, '').split("\n")[position.line];
        let lineContent = cachedState[0].text.replace(/\r/g, '').split("\n")[position.line];
        // let lineContent = cachedState[position.line];
        lineContent = lineContent.trim();
        while (lineContent.startsWith("/") || lineContent.startsWith("!")) {
            lineContent = lineContent.substring(1);
        }

        const absolutePath = path.dirname(gitignoreGood);
        // if (absolutePath.isErr()) {
        //     return Promise.reject(absolutePath.unwrapErr());
        // }

        const relativePath = path.dirname(lineContent);
        const fileName = path.basename(lineContent);

        const searchPath = path.join(absolutePath, relativePath, lineContent);
        if (!fs.existsSync(searchPath) || !fs.statSync(searchPath).isDirectory())
            return null;
        const paths = fs.readdirSync(searchPath, { withFileTypes: true });

        // return Promise.resolve(CompletionModule.completionItemsForPaths(paths, fileName, searchPath));
        return CompletionModule.completionItemsForPaths(paths, fileName, searchPath);
    }
}

CompletionModule.default = CompletionModule;

module.exports = CompletionModule;
