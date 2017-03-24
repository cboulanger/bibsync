var _ = require("underscore");

/**
 * Reference Types
 * @type {Object}
 */
var types = {
  abstract: {
    label: 'Abstract',
    RIS: 'ABST',
    bibtex: false
  },
  audiovisual: {
    label: 'Audiovisual material',
    RIS: 'ADVS',
    bibtex: false
  },
  audio: {
    label: 'Audio Recording',
    RIS: 'ADVS',
    bibtex: false
  },
  database: {
    label: 'Aggregated Database',
    RIS: 'AGGR',
    bibtex: false
  },
  ancient: {
    label: 'Ancient Text',
    RIS: 'ANCIENT',
    bibtex: false
  },
  journalArticle: {
    label: 'Journal Article',
    RIS: 'JOUR',
    bibtex: false
  },
  artwork: {
    label: 'Artwork',
    RIS: 'ART',
    bibtex: false
  },
  bill: {
    label: 'Bill',
    RIS: 'BILL',
    bibtex: false
  },
  blogPost: {
    label: 'Blog Post',
    RIS: 'BLOG',
    bibtex: false
  },
  book: {
    label: 'Book (Monograph)',
    RIS: 'BOOK',
    bibtex: false
  },
  bookSection: {
    label: 'Book Section',
    RIS: 'CHAP',
    bibtex: false
  },
  case: {
    label: 'Case',
    RIS: 'CASE',
    bibtex: false
  },
  chart: {
    label: 'Chart',
    RIS: 'CHART',
    bibtex: false
  },
  classical: {
    label: 'Classical Work',
    RIS: 'CLSWK',
    bibtex: false
  },
  software: {
    label: 'Computer program',
    RIS: 'COMP',
    bibtex: false
  },
  proceedings: {
    label: 'Conference proceedings',
    RIS: 'CONF',
    bibtex: false
  },
  paper: {
    label: 'Conference paper',
    RIS: 'CPAPER',
    bibtex: false
  },
  catalog: {
    label: 'Catalog',
    RIS: 'CTLG',
    bibtex: false
  },
  data: {
    label: 'Data file',
    RIS: 'DATA',
    bibtex: false
  },
  'web-db': {
    label: 'Online Database',
    RIS: 'DBASE',
    bibtex: false
  },
  dictionaryEntry: {
    label: 'DictionaryEntry',
    RIS: 'DICT',
    bibtex: false
  },
  dissertation: {
    label: 'Dissertation',
    RIS: 'THES',
    bibtex: false
  },
  document: {
    label: 'Unpublished Document',
    RIS: 'UNPB',
    bibtex: false
  },
  editorial: {
    label: 'Editorial',
    RIS: 'NEWS',
    bibtex: false
  },
  ebook: {
    label: 'Electronic Book',
    RIS: 'EBOOK',
    bibtex: false
  },
  echapter: {
    label: 'Electronic Book Section',
    RIS: 'ECHAP',
    bibtex: false
  },
  collection: {
    label: 'Edited Book',
    RIS: 'EDBOOK',
    bibtex: false
  },
  earticle: {
    label: 'Electronic Article',
    RIS: 'EJOUR',
    bibtex: false
  },
  internet: {
    label: 'Internet Resource',
    RIS: 'ELEC',
    bibtex: false
  },
  encyclopediaArticle: {
    label: 'Encyclopedia Article',
    RIS: 'ENCYC',
    bibtex: false
  },
  email: {
    label: 'Email',
    RIS: 'ICOMM',
    bibtex: false
  },
  equation: {
    label: 'Equation',
    RIS: 'EQUA',
    bibtex: false
  },
  figure: {
    label: 'Figure',
    RIS: 'FIGURE',
    bibtex: false
  },
  generic: {
    label: 'Generic',
    RIS: 'GEN',
    bibtex: false
  },
  government: {
    label: 'Government Document',
    RIS: 'GOVDOC',
    bibtex: false
  },
  grant: {
    label: 'Grant',
    RIS: 'GRANT',
    bibtex: false
  },
  hearing: {
    label: 'Hearing',
    RIS: 'HEAR',
    bibtex: false
  },
  interview: {
    label: 'Interview',
    RIS: 'JOUR',
    bibtex: false
  },
  inpress: {
    label: 'In Press',
    RIS: 'INPR',
    bibtex: false
  },
  journal: {
    label: 'Journal (full)',
    RIS: 'JFULL',
    bibtex: false
  },
  legal: {
    label: 'Legal Rule or Regulation',
    RIS: 'LEGAL',
    bibtex: false
  },
  letter: {
    label: 'Letter',
    RIS: 'UNPB',
    bibtex: false
  },
  note: {
    label: 'Note',
    RIS: 'UNPB',
    bibtex: false
  },
  manuscript: {
    label: 'Manuscript',
    RIS: 'MANSCPT',
    bibtex: false
  },
  map: {
    label: 'Map',
    RIS: 'MAP',
    bibtex: false
  },
  magazineArticle: {
    label: 'Magazine article',
    RIS: 'MGZN',
    bibtex: false
  },
  movie: {
    label: 'Motion Picture',
    RIS: 'MPCT',
    bibtex: false
  },
  multimedia: {
    label: 'Online Multimedia',
    RIS: 'MULTI',
    bibtex: false
  },
  music: {
    label: 'Music Score',
    RIS: 'MUSIC',
    bibtex: false
  },
  newspaperArticle: {
    label: 'Newspaper Article',
    RIS: 'NEWS',
    bibtex: false
  },
  podcast: {
    label: 'Podcast',
    RIS: 'BLOG',
    bibtex: false
  },
  pamphlet: {
    label: 'Pamphlet',
    RIS: 'UNPB',
    bibtex: false
  },
  patent: {
    label: 'Patent',
    RIS: 'PAT',
    bibtex: false
  },
  personal: {
    label: 'Personal Communication',
    RIS: 'PCOMM',
    bibtex: false
  },
  radioBroadcast: {
    label: 'Radio Broadcast',
    RIS: 'ADVS',
    bibtex: false
  },
  presentation: {
    label: 'Presentation',
    RIS: 'SLIDE',
    bibtex: false
  },
  report: {
    label: 'Report',
    RIS: 'RPRT',
    bibtex: false
  },
  review: {
    label: 'Review',
    RIS: 'JOUR',
    bibtex: false
  },
  serial: {
    label: 'Serial publication',
    RIS: 'SER',
    bibtex: false
  },
  slide: {
    label: 'Slide',
    RIS: 'SLIDE',
    bibtex: false
  },
  sound: {
    label: 'Sound recording',
    RIS: 'SOUND',
    bibtex: false
  },
  standard: {
    label: 'Standard',
    RIS: 'STAND',
    bibtex: false
  },
  statute: {
    label: 'Statute',
    RIS: 'STAT',
    bibtex: false
  },
  thesis: {
    label: 'Thesis',
    RIS: 'THES',
    bibtex: false
  },
  tvBroadcast: {
    label: 'TV Broadcast',
    RIS: 'VIDEO',
    bibtex: false
  },
  video: {
    label: 'Video recording',
    RIS: 'VIDEO',
    bibtex: false
  },
  webpage: {
    label: 'Webpage',
    RIS: 'ELEC',
    bibtex: false
  }
};


/**
 * Reference fields
 * @type {Object}
 */
var fields = {

  //
  id: {
    label: 'Internal reference ID',
    RIS: 'ID',
    bibtex: false
  },
  itemType: {
    label: 'Reference Type',
    RIS: 'TY',
    bibtex: false
  },
  key: {
    label: 'BibTeX Key',
    RIS: 'U1',
    bibtex: 'key'
  },
  globalId : {
    label : "Global ID",
    RIS : false,
    bibtex : false
  },

  //

  accessDate: {
    label: 'Access Date',
    RIS: 'Y2',
    bibtex: false
  },
  abstract: {
    label: 'Abstract',
    RIS: 'AB',
    bibtex: 'abstract'
  },
  authors: {
    label: 'Authors',
    RIS: 'AU',
    bibtex: 'author'
  },
  authorTranslated: {
    label: 'Translated Author',
    RIS: 'TA',
    bibtex: false
  },
  applicationNumber: {
    label: 'Application Number',
    RIS: false,
    bibtex: false
  },
  attachments: {
    label: 'Attachments',
    RIS: 'L1',
    bibtex: false
  },
  blogTitle: {
    label: 'Blog Title',
    RIS: 'JA',
    bibtex: 'journal'
  },
  bookTitle: {
    label: 'Book Title',
    RIS: 'T2',
    bibtex: 'booktitle'
  },
  collections: {
    label: 'Collections',
    RIS: false,
    bibtex: false
  },
  conferenceName: {
    label: 'Conference Name',
    RIS: 'JA',
    bibtex: 'howpublished'
  },
  callNumber: {
    label: 'Call Number',
    RIS: 'CN',
    bibtex: false
  },
  date: {
    label: 'Date',
    RIS: 'PJ',
    bibtex: 'year'
  },
  dateAdded: {
    label: 'Date added',
    RIS: false,
    bibtex: false
  },
  doi: {
    label: 'DOI',
    RIS: 'DO',
    bibtex: 'doi'
  },
  edition: {
    label: 'Edition',
    RIS: 'ED',
    bibtex: 'edition'
  },
  editors: {
    label: 'Editors',
    RIS: 'A3',
    bibtex: 'editor'
  },
  issue: {
    label: 'Issue',
    RIS: 'IS',
    bibtex: 'number'
  },
  isbn: {
    label: 'ISBN',
    RIS: 'SN',
    bibtex: false
  },
  issn: {
    label: 'ISSN',
    RIS: 'SN',
    bibtex: false
  },
  institution: {
    label: 'Institution',
    RIS: 'PB',
    bibtex: 'institution'
  },
  journal: {
    label: 'Journal',
    RIS: 'JA',
    bibtex: 'journal'
  },
  keywords: {
    label: 'Keywords',
    RIS: 'KW',
    bibtex: 'keywords'
  },
  language: {
    label: 'Language',
    RIS: 'LA',
    bibtex: false
  },
  place: {
    label: 'Place',
    RIS: 'CY',
    bibtex: 'address'
  },
  notes: {
    label: 'Notes',
    RIS: 'N1',
    bibtex: 'notes'
  },
  numberOfVolumes: {
    label: 'Number of Volumes',
    RIS: 'NV',
    bibtex: false
  },
  numPages: {
    label: 'Number of Pages',
    RIS: 'NV',
    bibtex: false
  },
  originalPublication: {
    label: 'Original Publication',
    RIS: 'OP',
    bibtex: false
  },
  pages: {
    label: 'Pages',
    RIS: 'SP',
    bibtex: 'pages'
  },
  publisher: {
    label: 'Publisher',
    RIS: 'PB',
    bibtex: 'publisher'
  },
  pubmedId: {
    label: 'PubMed ID',
    RIS: false,
    bibtex: false
  },
  reportNumber: {
    label: 'Report Number',
    RIS: 'IS',
    bibtex: 'number'
  },
  reprintEdition: {
    label: 'Reprint Edition',
    RIS: 'RP',
    bibtex: false
  },
  startPage: {
    label: 'First Page',
    RIS: 'SP',
    bibtex: 'startPage'
  },
  endPage: {
    label: 'Last Page',
    RIS: 'EP',
    bibtex: 'endPage'
  },
  title: {
    label: 'Title',
    RIS: 'T1',
    bibtex: 'title'
  },
  title2: {
    label: '2nd Title',
    RIS: 'T2',
    bibtex: 'subtitle'
  },
  titleTranslated: {
    label: 'Translated Title',
    RIS: 'TT',
    bibtex: false
  },
  translator: {
    label: 'Translator',
    RIS: 'A4',
    bibtex: false
  },
  url: {
    label: 'Url',
    RIS: 'UR',
    bibtex: 'url'
  },
  university: {
    label: 'University',
    RIS: 'PB',
    bibtex: 'publisher'
  },
  websiteTitle: {
    label: 'Blog Title',
    RIS: 'JA',
    bibtex: 'journal'
  },
  volume: {
    label: 'volume',
    RIS: 'VL',
    bibtex: 'volume'
  },
  numpages: {
    label: '# of Pages',
    RIS: false,
    bibtex: false
  },
  numberofvolumes: {
    label: '# of Volumes',
    RIS: false,
    bibtex: false
  },
  abstractnote: {
    label: 'Abstract',
    RIS: false,
    bibtex: false
  },
  accessdate: {
    label: 'Accessed',
    RIS: false,
    bibtex: false
  },
  applicationnumber: {
    label: 'Application Number',
    RIS: false,
    bibtex: false
  },
  archive: {
    label: 'Archive',
    RIS: false,
    bibtex: false
  },
  artworksize: {
    label: 'Artwork Size',
    RIS: false,
    bibtex: false
  },
  assignee: {
    label: 'Assignee',
    RIS: false,
    bibtex: false
  },
  billnumber: {
    label: 'Bill Number',
    RIS: false,
    bibtex: false
  },
  blogtitle: {
    label: 'Blog Title',
    RIS: false,
    bibtex: false
  },
  booktitle: {
    label: 'Book Title',
    RIS: false,
    bibtex: false
  },
  callnumber: {
    label: 'Call Number',
    RIS: false,
    bibtex: false
  },
  casename: {
    label: 'Case Name',
    RIS: false,
    bibtex: false
  },
  code: {
    label: 'Code',
    RIS: false,
    bibtex: false
  },
  codenumber: {
    label: 'Code Number',
    RIS: false,
    bibtex: false
  },
  codepages: {
    label: 'Code Pages',
    RIS: false,
    bibtex: false
  },
  codevolume: {
    label: 'Code Volume',
    RIS: false,
    bibtex: false
  },
  committee: {
    label: 'Committee',
    RIS: false,
    bibtex: false
  },
  company: {
    label: 'Company',
    RIS: false,
    bibtex: false
  },
  conferencename: {
    label: 'Conference Name',
    RIS: false,
    bibtex: false
  },
  country: {
    label: 'Country',
    RIS: false,
    bibtex: false
  },
  court: {
    label: 'Court',
    RIS: false,
    bibtex: false
  },
  datedecided: {
    label: 'Date Decided',
    RIS: false,
    bibtex: false
  },
  dateenacted: {
    label: 'Date Enacted',
    RIS: false,
    bibtex: false
  },
  dictionarytitle: {
    label: 'Dictionary Title',
    RIS: false,
    bibtex: false
  },
  distributor: {
    label: 'Distributor',
    RIS: false,
    bibtex: false
  },
  docketnumber: {
    label: 'Docket Number',
    RIS: false,
    bibtex: false
  },
  documentnumber: {
    label: 'Document Number',
    RIS: false,
    bibtex: false
  },
  encyclopediatitle: {
    label: 'Encyclopedia Title',
    RIS: false,
    bibtex: false
  },
  episodenumber: {
    label: 'Episode Number',
    RIS: false,
    bibtex: false
  },
  audiofiletype: {
    label: 'File Type',
    RIS: false,
    bibtex: false
  },
  filingdate: {
    label: 'Filing Date',
    RIS: false,
    bibtex: false
  },
  firstpage: {
    label: 'First Page',
    RIS: false,
    bibtex: false
  },
  audiorecordingformat: {
    label: 'Format',
    RIS: false,
    bibtex: false
  },
  videorecordingformat: {
    label: 'Format',
    RIS: false,
    bibtex: false
  },
  forumtitle: {
    label: 'Forum/Listserv Title',
    RIS: false,
    bibtex: false
  },
  genre: {
    label: 'Genre',
    RIS: false,
    bibtex: false
  },
  history: {
    label: 'History',
    RIS: false,
    bibtex: false
  },
  issuedate: {
    label: 'Issue Date',
    RIS: false,
    bibtex: false
  },
  issuingauthority: {
    label: 'Issuing Authority',
    RIS: false,
    bibtex: false
  },
  journalabbreviation: {
    label: 'Journal Abbr',
    RIS: false,
    bibtex: false
  },
  label: {
    label: 'Label',
    RIS: false,
    bibtex: false
  },
  programminglanguage: {
    label: 'Language',
    RIS: false,
    bibtex: false
  },
  legalstatus: {
    label: 'Legal Status',
    RIS: false,
    bibtex: false
  },
  legislativebody: {
    label: 'Legislative Body',
    RIS: false,
    bibtex: false
  },
  librarycatalog: {
    label: 'Library Catalog',
    RIS: false,
    bibtex: false
  },
  archivelocation: {
    label: 'Loc. in Archive',
    RIS: false,
    bibtex: false
  },
  interviewmedium: {
    label: 'Medium',
    RIS: false,
    bibtex: false
  },
  artworkmedium: {
    label: 'Medium',
    RIS: false,
    bibtex: false
  },
  meetingname: {
    label: 'Meeting Name',
    RIS: false,
    bibtex: false
  },
  nameofact: {
    label: 'Name of Act',
    RIS: false,
    bibtex: false
  },
  network: {
    label: 'Network',
    RIS: false,
    bibtex: false
  },
  patentnumber: {
    label: 'Patent Number',
    RIS: false,
    bibtex: false
  },
  posttype: {
    label: 'Post Type',
    RIS: false,
    bibtex: false
  },
  prioritynumbers: {
    label: 'Priority Numbers',
    RIS: false,
    bibtex: false
  },
  proceedingstitle: {
    label: 'Proceedings Title',
    RIS: false,
    bibtex: false
  },
  programtitle: {
    label: 'Program Title',
    RIS: false,
    bibtex: false
  },
  publiclawnumber: {
    label: 'Public Law Number',
    RIS: false,
    bibtex: false
  },
  publicationtitle: {
    label: 'Publication',
    RIS: false,
    bibtex: false
  },
  references: {
    label: 'References',
    RIS: false,
    bibtex: false
  },
  reportnumber: {
    label: 'Report Number',
    RIS: false,
    bibtex: false
  },
  reporttype: {
    label: 'Report Type',
    RIS: false,
    bibtex: false
  },
  reporter: {
    label: 'Reporter',
    RIS: false,
    bibtex: false
  },
  reportervolume: {
    label: 'Reporter Volume',
    RIS: false,
    bibtex: false
  },
  rights: {
    label: 'Rights',
    RIS: false,
    bibtex: false
  },
  runningtime: {
    label: 'Running Time',
    RIS: false,
    bibtex: false
  },
  scale: {
    label: 'Scale',
    RIS: false,
    bibtex: false
  },
  section: {
    label: 'Section',
    RIS: false,
    bibtex: false
  },
  series: {
    label: 'Series',
    RIS: false,
    bibtex: false
  },
  seriesnumber: {
    label: 'Series Number',
    RIS: false,
    bibtex: false
  },
  seriestext: {
    label: 'Series Text',
    RIS: false,
    bibtex: false
  },
  seriestitle: {
    label: 'Series Title',
    RIS: false,
    bibtex: false
  },
  session: {
    label: 'Session',
    RIS: false,
    bibtex: false
  },
  shorttitle: {
    label: 'Short Title',
    RIS: false,
    bibtex: false
  },
  studio: {
    label: 'Studio',
    RIS: false,
    bibtex: false
  },
  subject: {
    label: 'Subject',
    RIS: false,
    bibtex: false
  },
  system: {
    label: 'System',
    RIS: false,
    bibtex: false
  },
  thesistype: {
    label: 'Type',
    RIS: false,
    bibtex: false
  },
  maptype: {
    label: 'Type',
    RIS: false,
    bibtex: false
  },
  manuscripttype: {
    label: 'Type',
    RIS: false,
    bibtex: false
  },
  lettertype: {
    label: 'Type',
    RIS: false,
    bibtex: false
  },
  presentationtype: {
    label: 'Type',
    RIS: false,
    bibtex: false
  },
  versionnumber: {
    label: 'Version',
    RIS: false,
    bibtex: false
  },
  websitetitle: {
    label: 'Website Title',
    RIS: false,
    bibtex: false
  },
  websitetype: {
    label: 'Website Type',
    RIS: false,
    bibtex: false
  },
  custom1: {
    label: 'Custom 1',
    RIS: 'C1',
    bibtex: false
  },
  custom2: {
    label: 'Custom 2',
    RIS: 'C2',
    bibtex: false
  },
  custom3: {
    label: 'Custom 3',
    RIS: 'C3',
    bibtex: false
  },
  custom4: {
    label: 'Custom 4',
    RIS: 'C4',
    bibtex: false
  },
  custom5: {
    label: 'Custom 5',
    RIS: 'C5',
    bibtex: false
  },
  custom6: {
    label: 'Custom 6',
    RIS: 'C6',
    bibtex: false
  },
  custom7: {
    label: 'Custom 7',
    RIS: 'C7',
    bibtex: false
  }
};

/**
 * Module definition
 * @type {Object}
 */
module.exports = function( localDictionary ) {

  return {
    /**
     * Return the   label of the (global) field or type
     * @param  {String} key The global name of the field or type
     * @return {String|false} returns false if the field or type does not exist
     */
    getLabel : function(key)
    {
      return (types[key] && types[key].label) || ( fields[key] && fields[key].label );
    },

    /**
     * Return the RIS tag of the (global) field name
     * @param  {String} key The global name of the field or type
     * @return {String|false} returns false if the field or type does not exist
     */
    getRIS : function(key)
    {
      return fields[key] && fields[key].RIS;
    },

    /**
     * Given a dictionary, field name and reference data, return the name of the
     * field in the dictionary
     * @param  {Object} dictionary The dictionary
     * @param  {String} field      The name of the field to be translated
     * @param  {Object} data       Reference data
     * @return {String}      The translated field/type name
     */
    translateName: function(dictionary, field, data) {
      if (typeof dictionary[field] == "function") {
        return dictionary[field](data);
      }
      if (typeof dictionary[field] == "object" && typeof dictionary[field].translateFieldName == "function") {
        return dictionary[field].translateFieldName(data);
      }
      return dictionary[field];
    },

    /**
     * Given a dictionary, field name and reference data, translate the field content
     * @param  {Object} dictionary The dictionary
     * @param  {String} field The name of the field/type
     * @param  {Object} data The reference data
     * @return {String|Map} If String, the translated content of the field. If map,
     * the keys and values of several fields.
     */
    translateContent: function(dictionary, field, data) {
      if (typeof dictionary[field] == "object" && typeof dictionary[field].translateContent == "function") {
        return dictionary[field].translateContent(data);
      }
      return data[field];
    },


    /**
     * Given a global type name, return the local type name
     * @param  {String} globaType The name of the global type
     * @param  {Object} data The reference data
     * @return {String} The translated type
     */
    getLocalType: function(globaType, data) {
      return this.translateName(localDictionary.types.toLocal, globaType, data);
    },

    /**
     * Given a local type name, return the global type name
     * @param  {String} localType The name of the local type
     * @param  {Object} data The reference data
     * @return {String} The translated type
     */
    getGlobalType: function(localField, data) {
      return this.translateName(localDictionary.fields.toGlobal, localField, data);
    },

    /**
     * Test if given field name is a local field
     * @param  {String} fieldName The name of the field
     * @return {Boolean} Returns true if argument is a local field name, false if not
     */
    isLocalField: function(fieldName) {
      return localDictionary.fields.toGlobal[fieldName] !== undefined;
    },

    /**
     * Given a global field name, return the local field name
     * @param  {String} globalField The name of the global field
     * @param  {Object} data        The reference data
     * @return {String} The translated field name
     */
    getLocalField: function(globalField, data) {
      return this.translateName(localDictionary.fields.toLocal, globalField, data);
    },

    /**
     * Test if given field name is a global field
     * @param  {String} fieldName The name of the field
     * @return {Boolean} Returns true if argument is a global field name, false if not
     */
    isGlobalField: function(fieldName) {
      return fields[fieldName] !== undefined;
    },

    /**
     * Given a local field name, return the global field name
     * @param  {String} localField The name of the local field
     * @param  {Object} data        The reference data
     * @return {String} The translated field name
     * TODO
     */
    getGlobalField: function(localField, data) {
      return this.translateName(localDictionary.fields.toGlobal, localField, data);
    },

    /**
     * Given a local field content, return the global field content
     * @param  {String} localField The name of the global field
     * @param  {Object} data        The reference data
     * @return {String|Object} If String, the content of the given local field. If
     *                      Object, the keys and values of several local fields
     */
    getGlobalContent: function(localField, data) {
      //console.log("localField:"+localField);
      //console.dir (data );
      return this.translateContent(localDictionary.fields.toGlobal, localField, data);
    },

    /**
     * Given a global field content, return the local field content
     * @param  {String} localField The name of the local field
     * @param  {Object} data        The reference data
     * @return {String|Object} If String, the content of the given local field. If
     *                      Object, the keys and values of several local fields‚
     * TODO
     */
    getLocalContent: function(globalField, data) {
      return this.translateContent(localDictionary.fields.toLocal, globalField, data);
    },

    /**
     * Translate an local item to a global one
     * @param  {Object} item       The local item object
     * @return {Object}            The translated object
     */
    translateToGlobal : function( item )
    {
      var translatedItem = {};
      for( var key in item )
      {
        var translatedKey = this.getGlobalField( key, item );
        if( translatedKey === undefined ) continue; // skip if field name cannot be translated
        var translatedValue = this.getGlobalContent( key, item );
        if ( _.isObject( translatedValue) ){
          _.keys(translatedValue).forEach(function(key2){
            translatedItem[key2] =
              this._translateToGlobalHelper(translatedKey,translatedValue[key2],translatedItem);
          },this);
        } else {
          translatedItem[translatedKey] =
            this._translateToGlobalHelper(translatedKey,translatedValue,translatedItem);
        }
      }
      return translatedItem;
    },

    /**
     * Helper function to set values to the target on properties that might
     * already contain a value. The aim is to add array items or strings instead
     * of overwriting them.
     * @param  {String} translatedKey   The translated key
     * @param  {Array|String} translatedValue The translated content
     * @param  {Object} translatedItem  The item on which key/value are set
     * @return {Array|String} The result value to be set
     */
    _translateToGlobalHelper : function(translatedKey,translatedValue,translatedItem){
      var content = translatedItem[translatedKey];
      if ( content !== undefined || ! _.isString( translatedValue ) )
      {
        if ( _.isArray( translatedValue ) ){
          result= (content||"") + translatedValue.join("; ");
        } else if ( _.isString( translatedValue ) ) {
          result = (content||"") + "; " + translatedValue;
        } else {
          console.warn("Type mismatch in field " + translatedKey);
          result = false;
        }
      } else {
        result = translatedValue;
      }
      return result;
    },

    /**
     * Translate an global item to a local one
     * @param  {Object} item       The global item object
     * @return {Object}            The translated object
     */
    translateToLocal : function( item )
    {
      var translatedItem = {};
      for( var key in item )
      {
        var translatedKey = this.getLocalField( key, item );
        if( ! translatedKey ) continue; // skip if field name cannot be translated
        var translatedValue = this.getLocalContent( key, item );
        var content = translatedItem[translatedKey];
        if ( content !== undefined )
        {
          if ( _.isArray( content ) && _.isArray( translatedValue ) ){
            translatedItem[translatedKey] = content.concat( translatedValue );
          } else if ( _.isString( content ) && _isString( translatedValue ) ) {
            translatedItem[translatedKey] = content + "; " + translatedValue;
          } else if ( _.isObject( content ) && _.isObject( translatedValue ) ) {
            translatedItem[translatedKey] = _.extend( content, translatedValue );
          } else {
            console.warn("Type mismatch in field " + key);
          }
        } else {
            translatedItem[translatedKey] = translatedValue;
        }
      }
      return translatedItem;
    }
  };
};
