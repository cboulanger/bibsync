### Bibsync

A tool to synchronize bibliographic data across applications. Currently support
for the following applications is being implemented:

- Zotero (http://www.zotero.org)
- Bookends (http://www.sonnysoftware.com)

## Installation
This application uses Node version > 6. You will have to use `nvm use 7` or run 
it in a virtual machine if you only have a standard LTS version of node available. 
Transpilation through babel will be added later. 

- Clone repository
- Install the dependencies:
```
cd bibsync
npm install
git submodule update --init
cd lib/libZoteroJS
npm install
cd ../..
```
- Setup configuration: `cp config.json.dist config.json`, then edit `config.json`
    - Uncomment apiKey/userId section and provide credentials
    - If you have access to Zotero/WebDAV storage, uncomment sections and provide
      credentials.
    - If you use Bookends, set `enabled:true`
- Build the application front-end:
```
cd html/bibSync/
./generate.py source-hybrid
cd ../..
```
- `npm start`
- Open your browser at the given address

## Development status
Alpha/Proof-of-concept, Everything can and will change

## Extract chapters feature
- add a note containing the table of contents
- separate author, title and page information with a pipe symbol (`|`). They must
  be in one paragraph (can be separated by manual line breaks).
- The second line of the note MUST contain the string `[bibsync-toc:authors|title|pages]`.
  `authors`,`title`, `pages` can also be in a different order, depending on how they
  are placed in the chapter information in the TOC.

## Resources
- https://nodejs.org/api/ (The Node Standard Library)
- http://expressjs.com/de/api.html (The express http server)
- https://socket.io/docs/# (Real-time messaging)
- http://www.qooxdoo.org/5.0.1/apiviewer/ (front-end javascript framework)
- http://www.qookery.org/portal/qookery/en/home (qooxdoo with declarative UI)
- https://www.zotero.org/support/dev/web_api/v3/ (bibliographic data manager)
- https://groups.google.com/forum/#!forum/zotero-dev (Zotero developer group)
- https://github.com/fcheslack/libZoteroJS (Zotero JavaScript API)
- https://github.com/cboulanger/libZoteroJS (My own fork, with some workarounds for unresolved bugs)
- https://github.com/louischatriot/nedb (A simple file-based key-value store)
- https://github.com/request/request (A library to make http/s requests)
- https://www.npmjs.com/package/download (conveniently download files)
- https://www.npmjs.com/package/scissors (to manipulate pdfs)
- http://stringjs.com/ (String manipulation library)
- http://underscorejs.org/ (Array and object manipulation library)

## Scissors dependencies
# Linux:
```
apt-get install pdftk ghostscript poppler-utils
```
# Mac
Download from https://www.pdflabs.com/tools/pdftk-server/#download
```
brew install ghostscript xpdf
``` 