/**
 * Map global to local types
 */
var types_toLocal =
{ abstract: false,
  audiovisual: 'Audiovisual material',
  audio: 'Audiovisual material',
  database: undefined,
  ancient: undefined,
  journalArticle: 'Journal article',
  artwork: 'Artwork',
  bill: undefined,
  blogPost: 'Internet',
  book: 'Book',
  bookSection: 'Book chapter',
  case: undefined,
  chart: undefined,
  classical: undefined,
  software: false,
  proceedings: 'Conference proceedings',
  paper: 'Conference proceedings',
  catalog: undefined,
  data: undefined,
  webdb: undefined,
  dictionaryEntry: 'Book chapter',
  dissertation: 'Dissertation',
  document: 'Book',
  editorial: 'Editorial',
  ebook: undefined,
  echapter: undefined,
  collection: 'Edited book',
  earticle: 'Journal Article',
  internet: 'Internet',
  encyclopediaArticle: 'Book chapter',
  email: 'Personal communication',
  equation: false,
  figure: false,
  generic: false,
  government: false,
  grant: false,
  hearing: false,
  interview: 'Journal article',
  inpress: 'In press',
  journal: 'book',
  legal: false,
  letter: 'Letter',
  note: 'Letter',
  manuscript: 'Book',
  map: 'Map',
  magazineArticle: 'Journal article',
  movie: 'Audiovisual material',
  multimedia: 'Internet',
  music: false,
  newspaperArticle: 'Newspaper article',
  podcast: 'Internet',
  pamphlet: 'Letter',
  patent: 'patent',
  personal: 'Personal communication',
  radioBroadcast: 'Audiovisual material',
  presentation: false,
  report: 'Journal article',
  review: 'Review',
  serial: undefined,
  slide: false,
  sound: undefined,
  standard: undefined,
  statute: false,
  thesis: 'Dissertation',
  tvBroadcast: 'Audiovisual material',
  video: 'Audiovisual material',
  webpage: 'Internet'
};

/**
 * Map global to local fields
 */
var fields_toLocal =
{ id: 'id',
  itemType: {
    translateFieldName : function(data) {
      return 'type';
    },
    translateContent : function(data)
    {
      var localType = types_toLocal[data.itemType];
      if( typeof localType == "function" ){
        localType = localType(data);
      }
      //console.log("Type:" + data.itemType + " -> " + localType);
      return localType || "Journal article";
    }
  },
  key: 'user1',
  accessDate: 'user20',
  abstract: 'abstract',
  authors: {
    translateFieldName : function(data) {
      return 'authors';
    },
    translateContent : function(data)
    {
      return data.authors.split(/;/).map(function(elem){
        return elem.trim();
      }).join(", and ");
    }
  },
  authorTranslated: 'user9',
  applicationNumber: false,
  attachments: 'attachments',
  blogTitle: 'journal',
  bookTitle: 'volume',
  collections: 'groups',
  conferenceName: 'journal',
  callNumber: 'user5',
  date: 'date',
  dateAdded: 'added',
  doi: 'user17',
  edition: 'user2',
  editors: {
    translateFieldName : function(data) {
      return 'editors';
    },
    translateContent : function(data)
    {
      return data.editors.split(/;/).map(function(elem){
        return elem.trim();
      }).join(", and ");
    }
  },
  issue: 'issue',
  isbn: 'user6',
  issn: 'user6',
  institution: 'publisher',
  journal: 'journal',
  keywords: 'keywords',
  language: 'user7',
  place: 'location',
  notes: 'notes',
  numberOfVolumes: 'user13',
  numPages: 'user13',
  originalPublication: 'user11',
  pages: 'pages',
  publisher: 'publisher',
  pubmedId: 'user18',
  reportNumber: 'issue',
  reprintEdition: 'user12',
  startPage: false,
  endPage: false,
  title: 'title',
  title2: 'title2',
  titleTranslated: 'user10',
  translator: 'user3',
  url: 'url',
  university: 'publisher',
  websiteTitle: 'journal',
  volume: "volume",
  abstractNote: false,
  archive: false,
  artworkSize: false,
  assignee: false,
  billNumber: false,
  caseName: false,
  code: false,
  codeNumber: false,
  codePages: false,
  codeVolume: false,
  committee: false,
  company: false,
  country: false,
  court: false,
  DOI: false,
  dateDecided: false,
  dateEnacted: false,
  dictionaryTitle: false,
  distributor: false,
  docketNumber: false,
  documentNumber: false,
  encyclopediaTitle: false,
  episodeNumber: false,
  extra: false,
  audioFileType: false,
  filingDate: false,
  firstPage: false,
  audioRecordingFormat: false,
  videoRecordingFormat: false,
  forumTitle: false,
  genre: false,
  history: false,
  issueDate: false,
  issuingAuthority: false,
  journalAbbreviation: false,
  label: false,
  programmingLanguage: false,
  legalStatus: false,
  legislativeBody: false,
  libraryCatalog: false,
  archiveLocation: false,
  interviewMedium: false,
  artworkMedium: false,
  meetingName: false,
  nameOfAct: false,
  network: false,
  patentNumber: false,
  postType: false,
  priorityNumbers: false,
  proceedingsTitle: false,
  programTitle: false,
  publicLawNumber: false,
  publicationTitle: false,
  references: false,
  reportType: false,
  reporter: false,
  reporterVolume: false,
  rights: false,
  runningTime: false,
  scale: false,
  section: false,
  series: false,
  seriesNumber: false,
  seriesText: false,
  seriesTitle: false,
  session: false,
  shortTitle: false,
  studio: false,
  subject: false,
  system: false,
  thesisType: false,
  mapType: false,
  manuscriptType: false,
  letterType: false,
  presentationType: false,
  versionNumber: false,
  websiteType: false,
  custom1: 'user4',
  custom2: 'user8',
  custom3: 'user14',
  custom4: 'user15',
  custom5: 'user16',
  custom6: 'user19',
  version: 'user20'
};

/**
 * Map local to global types
 */
var types_toGlobal = {
  'Audiovisual material': 'video',
  'Journal article': 'journalArticle',
  Artwork: 'artwork',
  Internet: 'webpage',
  Book: 'book',
  'Book chapter': 'bookSection',
  'Conference proceedings': 'proceedings',
  Dissertation: 'thesis',
  Editorial: 'editorial',
  'Edited book': 'collection',
  'Journal Article': 'earticle',
  'Personal communication': 'personal',
  'In press': 'inpress',
  book: 'journal',
  Letter: 'pamphlet',
  Map: 'map',
  'Newspaper article': 'newspaperArticle',
  patent: 'patent',
  Review: 'review'
};

/**
 * Map local to global fields
 */
var fields_toGlobal ={
  id: 'id',
  type: {
    translateFieldName : function(data) {
      return 'itemType';
    },
    translateContent : function(data)
    {
      var globalType = types_toGlobal[data.type];
      if( typeof globalType == "function" ){
        globalType = globalType(data);
      }
      //console.log("Type:" + data.itemType + " -> " + localType);
      return globalType || "journalArticle";
    }
  },
  user1: 'key',
  user20: 'version',
  abstract: 'abstract',
  authors: {
    translateFieldName : function(data) {
      return 'authors';
    },
    translateContent : function(data)
    {
      return data.authors.split(/, and /).join("; ");
    }
  },
  user9: 'authorTranslated',
  editors : {
    translateFieldName : function(data) {
      return 'editors';
    },
    translateContent : function(data)
    {
      return data.editors.split(/, and /).join("; ");
    }
  },
  attachments: 'attachments',
  journal: 'journal',
  groups: {
    translateFieldName : function(data) {
      return 'collections';
    },
    translateContent : function(data)
    {
      return data.groups.split(/, /).join(";");
    }
  },
  user5: 'callNumber',
  date: 'date',
  added: 'dateAdded',
  user17: 'doi',
  user2: 'edition',
  issue: 'issue',
  user6: function(item){
    switch (item.type) {
      case "journal":
      case "journalArticle":
       return "issn";
      default:
        return "isbn";
      }
  },
  publisher: 'publisher',
  keywords: 'keywords',
  user7: 'language',
  location: 'place',
  notes: 'notes',
  user13: 'numPages',
  user11: 'originalPublication',
  pages: 'pages',
  user18: 'pubmedId',
  user12: 'reprintEdition',
  title: 'title',
  title2: 'title2',
  user10: 'titleTranslated',
  user3: 'translator',
  url: 'url',
  //user4: 'custom1',
  user8: 'custom2',
  user14: 'custom3',
  user15: 'custom4',
  user16: 'custom5',
  user19: 'custom6',
  volume : function(item){
    switch (item.type) {
      case "Book chapter": return "bookTitle";
      default: return "volume";
    }
  }
};

/**
 * Module definition
 */
module.exports = {
  types : {
    toLocal : types_toLocal,
    toGlobal  : types_toGlobal
  },
  fields : {
    toLocal : fields_toLocal,
    toGlobal  : fields_toGlobal
  },
  translateName : function( map, field, data ){
    if (typeof map[field] == "function") {
      return map[field](data);
    }
    if (typeof map[field] == "object" && typeof map[field].translateFieldName == "function") {
      return map[field].translateFieldName(data);
    }
    return map[field];
  },
  translateContent : function( map, field, data ){
    if (typeof map[field] == "object" && typeof map[field].translateContent == "function") {
      return map[field].translateContent(data);
    }
    return data[field];
  }
};
