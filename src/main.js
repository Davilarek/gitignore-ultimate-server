const { createConnection, TextDocuments, InitializeParams, InitializeResult, CompletionItemKind, WorkspaceFolder } = require('vscode-languageserver');
const fs = require('fs');
const path = require('path');

const connection = createConnection();

let workspace = null;

const CompletionModule = require("./features/completion");

const completionModule = new CompletionModule();

const serverCapabilities = {
    textDocumentSync: 1,
    completionProvider: {
        resolveProvider: true,
        // triggerCharacters: ['/']
        triggerCharacters: ['/']
    },
    workspace: {
        workspaceFolders: {
            supported: true,
            changeNotifications: true
        }
    }
};

connection.onInitialize((params) => {
    // workspace.initialize();

    // completionModule.initialize();
    workspace = params.workspaceFolders;

    return { capabilities: serverCapabilities };
});

connection.onInitialized(() => {
    connection.console.log('Server initialized successfully.');
});

connection.onShutdown(() => {});

connection.onDidOpenTextDocument((params) => {
    const textDocument = params.textDocument;
    const uri = textDocument.uri;
    const text = textDocument.text;

    // workspace.open(uri, text);
});

const cachedStates = {};

connection.onDidChangeTextDocument((params) => {
    const textDocument = params.textDocument;
    const uri = textDocument.uri;
    const changes = params.contentChanges;

    cachedStates[uri] = changes;
    // workspace.applyChanges(uri, changes);
});

connection.onDidCloseTextDocument((params) => {
    const textDocument = params.textDocument;
    const uri = textDocument.uri;

    // workspace.close(uri);
});

connection.onCompletion(async (params) => {
    const textDocument = params.textDocument;
    const uri = textDocument.uri;
    const position = params.position;

    const workspaceFolders = await connection.workspace.getWorkspaceFolders();
    const filePath = decodeURIComponent(path.normalize(require("url").parse(uri).pathname).slice(1));
    let workspaceFiles = [];
    for (let i = 0; i < workspaceFolders.length; i++) {
        const workspaceFolder = workspaceFolders[i];

        const folderPath = decodeURIComponent(path.normalize(require("url").parse(workspaceFolder.uri).pathname).slice(1));
        if (folderPath != path.dirname(filePath))
            continue;
        const files = fs.readdirSync(folderPath);
        workspaceFiles = files.map(x => ({ uri: require("url").pathToFileURL(x).href }));
    }

    const completions = completionModule.getCompletion(position, decodeURIComponent(uri), workspaceFiles, cachedStates[uri]);
    connection.console.log("got completions:");
    connection.console.log(JSON.stringify(completions));
    // return completions ? completions.map((completion) => {
    //     return {
    //         label: completion.label,
    //         kind: CompletionItemKind.Text,
    //         detail: completion.detail,
    //         documentation: completion.documentation,
    //         insertText: completion.insertText,
    //         sortText: completion.sortText
    //     };
    // }) : null;
    return completions;
});

connection.onCompletionResolve(
    (item) => {
        return item;
    }
);

connection.listen();
