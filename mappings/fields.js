/**
 * Reference fields
 * properties db,bibtex,zotero,bookends: if not defined, same as key
 * @todo BibTeX
 */
var fields = {
  "id" : {
    label     : "Internal reference ID",
    RIS       : "ID",
    bibtex    : false,
    zotero    : "key",
  },
  "type" : {
    label     : "Reference Type",
    RIS       : "TY",
    bibtex    : false,
    zotero    : false, // @todo
  },
  "key" : {
    label     : "BibTeX Key",
    RIS       : "U1", // as used for importing into Bookends
    bibtex    : "key",
    bookends  : "user1",
    zotero    : false, // @todo
  },
  "accessDate": { RIS: "Y2", bibtex : false, bookends : "user20", label : "Access Date"},
  "abstract"  : { RIS : "AB", zotero : "abstractNote" },
  "authors" : {
    RIS       : "AU",
    bibtex    : "author" },
  "authorTranslated"     : { RIS : "TA", bibtex : false, bookends : "user9",  label : "Translated Author" },
  "applicationNumber" : { RIS: false, bookends: false, label: "Application Number"},
  "attachments" : { RIS : "L1", bibtex : false, zotero: false, label : "Attachments" },
  "blogTitle" : { label: "Blog Title", RIS : "JA", bibtex : "journal", bookends : "journal" },
  "bookTitle" : { label: "Book Title", RIS : "T2", bibtex : "booktitle", bookends : "volume" },
  "collections" : { RIS : false, bibtex : false, zotero : false, bookends : "groups", label : "Collections" },
  "conferenceName" : { RIS : "JA", bibtex : "howpublished", bookends : "journal", label : "Conference Name" },
  "callNumber"  : { RIS : "CN", bibtex : false, bookends : "user5", label : "Call Number" },
  "date"      : { RIS : "PJ", bibtex : "year", bookends: "date" },
  "dateAdded"  : { RIS : false, bibtex : false, bookends : "added", label : "Date added" },
  "doi"       : { RIS : "DO", bibtex : "doi", bookends : "user17", label : "DOI" },
  "edition"   : { RIS : "ED", bookends : "user2", label : "Edition" },
  "editors"   : { RIS : "A3", bibtex : "editor" },
  "issue"     : { RIS : "IS", bibtex : "number" },
  "isbn"      : { RIS : "SN", bibtex : false, bookends : "user6", label : "ISBN" },
  "issn"      : { RIS : "SN", bibtex : false, bookends : "user6", label : "ISSN" },
  "institution" : { label : "Institution", RIS : "PB", bibtex : "institution", bookends : "publisher" },
  "journal"   : { RIS : "JA" },
  "keywords"  : { RIS : "KW" },
  "language"  : { RIS : "LA", bibtex : false, bookends : "user7", label : "Language" },
  "place"     : { label: "Place", RIS : "CY", bibtex : "address", bookends : "location"  },
  "notes"     : { RIS : "N1" },
  "numberOfVolumes" : { RIS : "NV",  bibtex : false,  bookends  : "user13", label : "Number of Volumes" },
  "numPages" : { RIS : "NV", bibtex : false, bookends : "user13", label : "Number of Pages" },
  "originalPublication"  : { RIS : "OP", bibtex : false, bookends : "user11", label : "Original Publication" },
  "pages"     : { RIS : "SP" },
  "publisher" : { RIS : "PB"},
  "pubmedId" : { RIS : false, bibtex : false, bookends : "user18", label : "PubMed ID" },
  "reportNumber" : { RIS : "IS", bibtex : "number", bookends : "issue", label : "Report Number" },
  "reprintEdition" : { RIS : "RP", bibtex : false, bookends : "user12", label : "Reprint Edition" },
  "startPage" : { label : "First Page", RIS : "SP", bookends : false, zotero : "firstPage"},
  "endPage"   : { label : "Last Page", RIS : "EP", bookends : false, zotero : false },
  "title"     : { RIS : "T1" },
  "title2"    : { RIS : "T2", bibtex : "subtitle", label : "2nd Title" },
  "titleTranslated"      : { RIS : "TT", bibtex : false, bookends : "user10", label : "Translated Title" },
  "translator"  : { RIS : "A4", bibtex : false, bookends : "user3", label : "Translator" },
  "url"         : { RIS : "UR" },
  "university"  : { RIS : "PB", bibtex : "publisher", bookends : "publisher"},
  "websiteTitle" : { label: "Blog Title", RIS : "JA", bibtex : "journal", bookends : "journal" },
  "volume" : {
    label       : "volume",
    RIS         : "VL",
    bibtex      : "volume",
    bookends    : function(dict){
      switch (dict.type) {
        case "bookSection": return "bookTitle";
        default: return "volume";
      }
    }
  },
};

for (var key in fields)
{
    ["bibtex","bookends","zotero"].forEach( function(prop) {
      if( fields[key][prop] === undefined ){
        fields[key][prop] = key;
      }
    });
    if( fields[key].label === undefined ){
      fields[key].label = key[0].toUpperCase() + key.substring(1);
    }
}

// add zotero fields
var zoteroFields = require("./zotero-fields");
zoteroFields.forEach(function(elem){
  var field = elem.field.toLowerCase();
  if ( fields[field] === undefined )
  {
    fields[field] = {
      label     : elem.localized,
      RIS       : false,
      bibtex    : false,
      bookends  : false
    };
  }
});

module.exports = fields;
