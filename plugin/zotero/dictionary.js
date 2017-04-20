var _ = require('underscore');

/**
 * Map global to local types
 */
var types_toLocal =
{ abstract: false,
  audiovisual: false,
  audio: 'audioRecording',
  database: 'database',
  ancient: false,
  journalArticle: 'journalArticle',
  artwork: 'artwork',
  bill: 'bill',
  blogPost: 'blogPost',
  book: 'book',
  bookSection: 'bookSection',
  case: 'case',
  chart: false,
  classical: false,
  software: 'computerProgram',
  proceedings: 'book',
  paper: 'conferencePaper',
  catalog: 'book',
  data: false,
  webdb: false,
  dictionaryEntry: 'dictionaryEntry',
  dissertation: 'thesis',
  document: 'document',
  editorial: 'newspaperArticle',
  ebook: 'book',
  echapter: 'bookSection',
  collection: 'book',
  earticle: 'journalArticle',
  internet: 'webpage',
  encyclopediaArticle: 'encyclopediaArticle',
  email: 'email',
  equation: false,
  figure: false,
  generic: false,
  government: false,
  grant: false,
  hearing: 'hearing',
  interview: 'interview',
  inpress: 'inpress',
  journal: 'book',
  legal: 'bill',
  letter: 'letter',
  note: 'note',
  manuscript: 'manuscript',
  map: 'map',
  magazineArticle: 'magazineArticle',
  movie: 'movie',
  multimedia: 'multimedia',
  music: false,
  newspaperArticle: 'newspaperArticle',
  podcast: 'podcast',
  pamphlet: 'document',
  patent: 'patent',
  personal: 'letter',
  radioBroadcast: 'radioBroadcast',
  presentation: 'presentation',
  report: 'report',
  review: 'journalArticle',
  serial: 'serial',
  slide: false,
  sound: 'sound',
  standard: 'standard',
  statute: 'statute',
  thesis: 'thesis',
  tvBroadcast: 'tvBroadcast',
  video: 'videoRecording',
  webpage: 'webpage'
};

/**
 * Map global to local fields
 */
var fields_toLocal =
{ id: 'key',
  itemType: {
    translateFieldName : function(data) {
      return 'itemType';
    },
    translateContent : function(data)
    {
      var localType = types_toLocal[data.itemType];
      if( typeof localType == "function" ){
        localType = localType(data);
      }
      //console.log("Type:" + data.itemType + " -> " + localType);
      return localType || "journalArticle";
    }
  },
  key: 'extra',
  accessDate: 'accessDate',
  abstract: 'abstractNote',
  attachments : "attachments",
  authors: {
    translateFieldName   : function(data) {
      return 'creators';
    },
    translateContent : function(data){
      creatorsMap = [];
      data.authors.split(/;/).map(function(elem){
        if( _.contains(elem,",") ){
          part = elem.split(/,/);
          creatorsMap.push({
            creatorType : "author",
            lastName    : part[0].trim(),
            firstName   : part[1].trim()
          });
        } else {
          creatorsMap.push({
            creatorType : "author",
            name        : elem.trim()
          });
        }
      });
      return creatorsMap;
    }
  },
  authorTranslated: 'authorTranslated',
  applicationNumber: 'applicationNumber',
  attachments: false,
  blogTitle: 'blogTitle',
  bookTitle: 'bookTitle',
  collections: false,
  conferenceName: 'conferenceName',
  callNumber: 'callNumber',
  date: 'date',
  dateAdded: 'dateAdded',
  doi: 'DOI',
  edition: 'edition',
  editors: {
    translateFieldName   : function(data) {
      return 'creators';
    },
    translateContent : function(data){
      creatorsMap = [];
      data.editors.split(/;/).map(function(elem){
        if( _.contains(elem,",") ){
          part = elem.split(/,/);
          creatorsMap.push({
            creatorType : "editor",
            lastName    : part[0].trim(),
            firstName   : part[1].trim()
          });
        } else {
          creatorsMap.push({
            creatorType : "editor",
            name        : elem.trim()
          });
        }
      });
      return creatorsMap;
    }
  },
  issue: 'issue',
  isbn: 'ISBN',
  issn: 'ISSN',
  institution: 'institution',
  journal: 'publicationTitle',
  keywords: {
    translateFieldName   : function(data) {
      return "tags";
    },
    translateContent : function(data){
      var content = data.keywords.split(/;/).map(function(elem){
        return { tag : elem.trim(), type : 1 };
      });
      return content;
    }
  },
  language: 'language',
  place: 'place',
  notes: {
    translateFieldName   : function(data) {
      return "notes";
    },
    translateContent : function(data){
      var content = data.notes.replace(/(?:\r\n|\r|\n)/g, '<br />');
      return content;
    }
  },
  numberOfVolumes: 'numberOfVolumes',
  numPages: 'numPages',
  originalPublication: 'originalPublication',
  pages: 'pages',
  publisher: 'publisher',
  pubmedId: 'pubmedId',
  reportNumber: 'reportNumber',
  reprintEdition: 'reprintEdition',
  startPage: 'firstPage',
  endPage: false,
  title: 'title',
  title2: false,
  titleTranslated: 'titleTranslated',
  translator: 'translator',
  url: 'url',
  university: 'university',
  websiteTitle: 'websiteTitle',
  volume: 'volume',
  abstractNote: 'abstractNote',
  archive: 'archive',
  artworkSize: 'artworkSize',
  assignee: 'assignee',
  billNumber: 'billNumber',
  caseName: 'caseName',
  code: 'code',
  codeNumber: 'codeNumber',
  codePages: 'codePages',
  codeVolume: 'codeVolume',
  committee: 'committee',
  company: 'company',
  country: 'country',
  court: 'court',
  dateDecided: 'dateDecided',
  dateEnacted: 'dateEnacted',
  dictionaryTitle: 'dictionaryTitle',
  distributor: 'distributor',
  docketNumber: 'docketNumber',
  documentNumber: 'documentNumber',
  encyclopediaTitle: 'encyclopediaTitle',
  episodeNumber: 'episodeNumber',
  extra: 'extra',
  audioFileType: 'audioFileType',
  filingDate: 'filingDate',
  firstPage: 'firstPage',
  audioRecordingFormat: 'audioRecordingFormat',
  videoRecordingFormat: 'videoRecordingFormat',
  forumTitle: 'forumTitle',
  genre: 'genre',
  history: 'history',
  issueDate: 'issueDate',
  issuingAuthority: 'issuingAuthority',
  journalAbbreviation: 'journalAbbreviation',
  label: 'label',
  programmingLanguage: 'programmingLanguage',
  legalStatus: 'legalStatus',
  legislativeBody: 'legislativeBody',
  libraryCatalog: 'libraryCatalog',
  archiveLocation: 'archiveLocation',
  interviewMedium: 'interviewMedium',
  artworkMedium: 'artworkMedium',
  meetingName: 'meetingName',
  nameOfAct: 'nameOfAct',
  network: 'network',
  patentNumber: 'patentNumber',
  postType: 'postType',
  priorityNumbers: 'priorityNumbers',
  proceedingsTitle: 'proceedingsTitle',
  programTitle: 'programTitle',
  publicLawNumber: 'publicLawNumber',
  publicationTitle: 'publicationTitle',
  references: 'references',
  reportType: 'reportType',
  reporter: 'reporter',
  reporterVolume: 'reporterVolume',
  rights: 'rights',
  runningTime: 'runningTime',
  scale: 'scale',
  section: 'section',
  series: 'series',
  seriesNumber: 'seriesNumber',
  seriesText: 'seriesText',
  seriesTitle: 'seriesTitle',
  session: 'session',
  shortTitle: 'shortTitle',
  studio: 'studio',
  subject: 'subject',
  system: 'system',
  thesisType: 'thesisType',
  mapType: 'mapType',
  manuscriptType: 'manuscriptType',
  letterType: 'letterType',
  presentationType: 'presentationType',
  versionNumber: 'versionNumber',
  websiteType: 'websiteType',
  custom1: 'extra',
  custom2: false,
  custom3: false,
  custom4: false,
  custom5: false,
  custom6: false,
  custom7: false
};

/**
 * Map local to global types
 */
var types_toGlobal = {
  attachment : "attachment",
  audioRecording: 'audio',
  database: 'database',
  journalArticle: 'journalArticle',
  artwork: 'artwork',
  bill: 'legal',
  blogPost: 'blogPost',
  book: function(data){
    return ( data.creators && data.creators.some(function(item){
      return item.creatorType == "editor";
    }) ) ? "collection" : "book";
  },
  bookSection: 'echapter',
  case: 'case',
  computerProgram: 'software',
  conferencePaper: 'paper',
  dictionaryEntry: 'dictionaryEntry',
  thesis: 'thesis',
  document: 'pamphlet',
  newspaperArticle: 'newspaperArticle',
  webpage: 'webpage',
  encyclopediaArticle: 'encyclopediaArticle',
  email: 'email',
  hearing: 'hearing',
  interview: 'interview',
  inpress: 'inpress',
  letter: 'personal',
  note: 'note',
  manuscript: 'manuscript',
  map: 'map',
  magazineArticle: 'magazineArticle',
  movie: 'movie',
  multimedia: 'multimedia',
  podcast: 'podcast',
  patent: 'patent',
  radioBroadcast: 'radioBroadcast',
  presentation: 'presentation',
  report: 'report',
  serial: 'serial',
  sound: 'sound',
  standard: 'standard',
  statute: 'statute',
  tvBroadcast: 'tvBroadcast',
  videoRecording: 'video'
};

/**
 * Map local to global fields
 */
var fields_toGlobal =
{ key: 'id',
  itemType: {
    translateFieldName : function(data) {
      return 'itemType';
    },
    translateContent : function(data)
    {
      var globalType = types_toGlobal[data.itemType];
      if( typeof globalType == "function" ){
        globalType = globalType(data);
      }
      //console.log("Type:" + data.itemType + " -> " + globalType);
      return globalType || "journalArticle";
    }
  },
  accessDate: 'accessDate',
  abstractNote: 'abstractNote',
  creators: {
    translateFieldName   : function() {return false;}, // field name depends on content
    translateContent : function(data){
      var field, content={};
      data.creators.map(function(elem) {
        var name = elem.name || elem.lastName + ", " + elem.firstName;
        switch (elem.creatorType) {
          case "editor": field = "editors"; break;
          default: field = "authors"; break;
        }
        content[field] = (content[field]?content[field]+"; ":"")+ name;
      });
      return content;
    }
  },
  creatorSummary: 'creatorSummary',
  tags: {
    translateFieldName   : function(data) {
      return "keywords";
    },
    translateContent : function(data){
      var content = data.tags.reduce(function(result, elem){
        return (result ? result + "; " :"") + elem.tag;
      },"");
      return content;
    }
  },
  authorTranslated: 'authorTranslated',
  applicationNumber: 'applicationNumber',
  blogTitle: 'blogTitle',
  bookTitle: 'bookTitle',
  conferenceName: 'conferenceName',
  callNumber: 'callNumber',
  date: 'date',
  dateAdded: 'dateAdded',
  DOI: 'doi',
  edition: 'edition',
  editors: 'editors',
  issue: 'issue',
  ISBN: 'isbn',
  ISSN: 'issn',
  institution: 'institution',
  publicationTitle: 'journal',
  keywords: 'keywords',
  language: 'language',
  place: 'place',
  notes: 'notes',
  numberOfVolumes: 'numberOfVolumes',
  numPages: 'numPages',
  originalPublication: 'originalPublication',
  pages: 'pages',
  publisher: 'publisher',
  pubmedId: 'pubmedId',
  reportNumber: 'reportNumber',
  reprintEdition: 'reprintEdition',
  firstPage: 'firstPage',
  title: 'title',
  titleTranslated: 'titleTranslated',
  translator: 'translator',
  url: 'url',
  university: 'university',
  websiteTitle: 'websiteTitle',
  volume: 'volume',
  archive: 'archive',
  artworkSize: 'artworkSize',
  assignee: 'assignee',
  billNumber: 'billNumber',
  caseName: 'caseName',
  code: 'code',
  codeNumber: 'codeNumber',
  codePages: 'codePages',
  codeVolume: 'codeVolume',
  committee: 'committee',
  company: 'company',
  country: 'country',
  court: 'court',
  dateDecided: 'dateDecided',
  dateEnacted: 'dateEnacted',
  dictionaryTitle: 'dictionaryTitle',
  distributor: 'distributor',
  docketNumber: 'docketNumber',
  documentNumber: 'documentNumber',
  encyclopediaTitle: 'encyclopediaTitle',
  episodeNumber: 'episodeNumber',
  extra: 'custom1',
  audioFileType: 'audioFileType',
  filingDate: 'filingDate',
  audioRecordingFormat: 'audioRecordingFormat',
  videoRecordingFormat: 'videoRecordingFormat',
  forumTitle: 'forumTitle',
  genre: 'genre',
  history: 'history',
  issueDate: 'issueDate',
  issuingAuthority: 'issuingAuthority',
  journalAbbreviation: 'journalAbbreviation',
  label: 'label',
  programmingLanguage: 'programmingLanguage',
  legalStatus: 'legalStatus',
  legislativeBody: 'legislativeBody',
  libraryCatalog: 'libraryCatalog',
  archiveLocation: 'archiveLocation',
  interviewMedium: 'interviewMedium',
  artworkMedium: 'artworkMedium',
  meetingName: 'meetingName',
  nameOfAct: 'nameOfAct',
  network: 'network',
  patentNumber: 'patentNumber',
  postType: 'postType',
  priorityNumbers: 'priorityNumbers',
  proceedingsTitle: 'proceedingsTitle',
  programTitle: 'programTitle',
  publicLawNumber: 'publicLawNumber',
  references: 'references',
  reportType: 'reportType',
  reporter: 'reporter',
  reporterVolume: 'reporterVolume',
  rights: 'rights',
  runningTime: 'runningTime',
  scale: 'scale',
  section: 'section',
  series: 'series',
  seriesNumber: 'seriesNumber',
  seriesText: 'seriesText',
  seriesTitle: 'seriesTitle',
  session: 'session',
  shortTitle: 'shortTitle',
  studio: 'studio',
  subject: 'subject',
  system: 'system',
  thesisType: 'thesisType',
  mapType: 'mapType',
  manuscriptType: 'manuscriptType',
  letterType: 'letterType',
  presentationType: 'presentationType',
  versionNumber: 'versionNumber',
  websiteType: 'websiteType'
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
  }
};
