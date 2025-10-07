/**
 * This is the JS for new jesoes.com
 * 
 * Purpose:
 * 1. Promote my own OBF (Open Bible Format) v2.0 (JSON)
 *    - So other people can create the many Bible data and use for their own purposes.
 * 2. OBF manager (downloader + load/save to DB)
 * 
 * TODO:
 * 1. CORS on Google Cloud Storage and allow only from https://jesoes.com !!
 *   - currently set to allow only from https://jesoes.com, https://www.gue2.com, and http://localhost:9090 (for development)
 * 
 * 
 * History:
 * 2024-10-03
 * -in async loadBibleList() if failed then clear cache (localStorage.clear()) to reset !!!
 * 
 * 2024-09-16:
 * - Created jesoes_OBF_manager.js 
 */

var log = log || console.log;
var error = error || console.error;

class JesoesOBFManager {
    // public static variable

    // ECMAScript 2015 (ES6).
    // singleton
    static instance;

    constructor() {
        if(! JesoesOBFManager.instance) {
            // create new
            JesoesOBFManager.instance = this;
        } else {
            // already created, just return it
            return JesoesOBFManager.instance;
        }

        // private property (variable) class 
        this.bible_list = null;
        this.mainBibleContent = null;
        this.mainBibleCode = '';
        this.extraBibleContent = []; /* first in first display (sorting), WARNING: never set NULL!!! */
        this.extraBibleCodes = [];
        this.loadedBibleContent = []; /* loaded from DB or from download (if DB is not supported) */

        // this.currentReadBookId = 1;
        // this.currentReadChapterNumber = 1;
        // this.currentReadVerseNumber = 1;
        // this.currentReadVerseToNumber = 0;

        this.dbHelper = null;

        /**
         * during debugging, after delete database (to reset), better change dbName to make sure code is working!!
         * 
         * WARNING: we can delete db manually in local browser !!
         * BUT in other people devices we can not do it because in JS, there is no way to list all existing dbName, so there is no way to delete all dbName
         * only to try to open all potential names and deletes them manually.
         * 
         * 
         * const databaseNames = ['database1', 'database2', 'database3']; 
         * databaseNames.forEach(dbName => {
         *     const request = indexedDB.deleteDatabase(dbName);
         *     request.onsuccess = (event) => {
         *       console.log(`Database ${dbName} deleted successfully`);
         *     };
         *     request.onerror = (event) => {
         *       console.error(`Error deleting database ${dbName}:`, event.target.error);
         *     };
         * });
         */ 
        this.dbName = 'jesoesDb';

        /**
         * increase dbVersion 
         * 1. Different (or has new) store(s)
         * 2. Different schema or keyPath
         * 3. New BIBLE_LIST JSON
         * 4. New BIBLE_STRUCTURE JSON
         * 5. New BIBLE_CONTENT JSONs
         * 
         * maximum 2,147,483,647 (2^31 - 1) == 32 Bits.
         */
        this.dbVersion = 20241006; // use date value, it is good to remember

        return this;
    }

    getBookContent(bookNumber, chapterNumber, verseNumber, toVerseNumber = 0) {
        let msg = `getBookContent(${bookNumber}, ${chapterNumber}, ${verseNumber}, ${toVerseNumber})`;
        log(msg);

        // return the content in JSON, let caller to make HTML or style.
        var content = { 'bookName' : this.getBookNumberName(bookNumber), 'bookNumber': bookNumber, 'chapterNumber': chapterNumber };

        // TODO: continue here !

        return content;
    }
    
    // private function (using ES6 #)
    download_JSON = (url, callback) => {
        const xhr = new XMLHttpRequest();

        xhr.open('GET', url);
        
        // Set the Accept-Encoding header to fasten delivery
        // previously GCS send uncompress JSON which is very large
        xhr.setRequestHeader('Accept-Encoding', 'gzip');

        xhr.responseType = 'json';
        xhr.onload = function() {
            if (xhr.status === 200) {
                log('download_JSON(' + url + ') completed');

                callback(xhr.response);            
            } else {
                log.apply('Error: download_JSON(' + url + '): ' + xhr.status);
            }
        };
        xhr.send();
    }

    async loadBibleList(callbackOnSuccess) {

        // check cache
        this.dbHelper = new IndexedDBHelper(this.dbName, this.dbVersion);

        // let 'id' as default 1 ==> always 1 because only 1 single data
        // 2024-10-03: ONLY at this time when call dbHelper.getData(), we add callback just in case there is error so we can localStorage.clear() to reset !!!
        // this will force user to refresh
        const data = await this.dbHelper.getData(IndexedDBHelper.BIBLE_LIST, 1, (errorMsg) => {
            log(`loadBibleList(callbackOnSuccess), errorMsg: ${errorMsg}`);

            // 2024-10-03: important note, there should not be any error, probably lower version !!
            // in any case, we delete all localStorage too !!

            // delete all localStore !!!
            localStorage.clear();

            log(`localStorage cache is deleted, please retry !`);

            // force page refresh
            location.refresh();
        }); 

        //if(! data || data.success != false) {
        if(data) {
            log(`loadBibleList(), loaded data: ${data}`);

            this.bible_list = data; // get original JSON (without 'id')

            // get all Bible from the list!
            this.parseBibleListAndDownloadAllBibles(this.bible_list, true, () => {

                // Set main Bible and extra Bibles
                this.setMainBibleAndExtraBibles();
               
                callbackOnSuccess();
            });
        } else {
            log(`loadBibleList(), failed or no data to load, going to download it`);
            this.downloadBibleList(() => {

                // Set main Bible and extra Bibles
                this.setMainBibleAndExtraBibles();

                callbackOnSuccess();
            });
        }

        /**
         * IMPORTANT: bible_list have to be always downloaded for proper sync 
         * to avoid device keeping OLD bible_list value !!
         * 
         * To update new bible_list.json, simply upload it to GCS bucket !!
         * 
         * 2024-09-21: first version will NOT download it
         * ONLY when there is a change in bible_list.json THEN release jesoes_OBF_manager-vxxx.js !!
         */
        const ALWAYS_DOWNLOAD_BIBLE_LIST = true;
        if(ALWAYS_DOWNLOAD_BIBLE_LIST) {
            log(`ALWAYS_DOWNLOAD_BIBLE_LIST = true`);
            this.downloadBibleList(() => {

                // Set main Bible and extra Bibles
                this.setMainBibleAndExtraBibles();

                callbackOnSuccess();
            });
        }
    }

    setMainBibleAndExtraBibles() {
        // at this point point, all Bible contents must be loaded !!!
        log(`setMainBibleAndExtraBibles()`);

        const mainBibleCode = this.loadMainBibleCode();
        const extraBibleCodes = this.loadExtraBibleCodes();

        const totalLoadedBibleInMemory = this.loadedBibleContent.length;

        // find the mainBibleCode in loaded bible in memory
        this.mainBibleContent = null; // reset        
        for(let i = 0; i < totalLoadedBibleInMemory; i++) {
            if(this.loadedBibleContent[i].code.toLowerCase() == mainBibleCode.toLowerCase()) {
                log(`setMainBibleAndExtraBibles(), found main bible code '${mainBibleCode}'`);
                this.mainBibleContent = this.loadedBibleContent[i];
                break;
            }
        }

        // find the extraBibleCodes in loaded bible in memory
        this.extraBibleContent = []; // reset to empty array        
        for(let i = 0; i < totalLoadedBibleInMemory; i++) {
            for(let y = 0; y < extraBibleCodes.length; y++) {
                if(this.loadedBibleContent[i].code.toLowerCase() == extraBibleCodes[y].toLowerCase()) {
                    log(`setMainBibleAndExtraBibles(), found extra bible code '${extraBibleCodes[y]}'`);
                    this.extraBibleContent.push(this.loadedBibleContent[i]);
                }
            }
        }        
    }

    downloadBibleList(callback) {
        // POLICY: even if already in DB, still need to download it to automate upgrade
        log(`downloadBibleList(), going to download bible list`);

        // to prevent Google cache, add unique parameter        
        //let bible_list_filename = 'bible_list_2024-10-20_14-57-13';
        let bible_list_filename = 'bible_list_2025-10-07_20-43-59';
        let bible_list_JSON_url = `https://storage.googleapis.com/jesoes/bible-json/${bible_list_filename}.json?caller_time=${(new Date().toISOString())}`;
        
        // download it
        this.download_JSON(bible_list_JSON_url, async (data) => {
            log(`downloadBibleList(callback), result:`);
            log(JSON.stringify(data, null, 2));

            this.bible_list = data;
            

            // // 2024-10-03: POLICY if BIBLE_LIST exist then delete all bible content !
            // let existing_bible_list = await this.dbHelper.getData(IndexedDBHelper.BIBLE_LIST);
            // if(existing_bible_list) {
            //     log(`downloadBibleList(callback), BIBLE_LIST is downloaded but it is already exist, so delete all Bible Content !!`);
            //     this.dbHelper.deleteDatabase(this.dbName, () => {
            //         // save it
            //         this.dbHelper.putData(IndexedDBHelper.BIBLE_LIST, data); // let 'id' as default 1, because only 1 row

            //         // get all Bible from the list!
            //         this.parseBibleListAndDownloadAllBibles(this.bible_list, false, callback); // just download if not exist, do not replace memory
            //     });
            // } else {
            //     // save it
            //     this.dbHelper.putData(IndexedDBHelper.BIBLE_LIST, data); // let 'id' as default 1, because only 1 row

            //     // get all Bible from the list!
            //     this.parseBibleListAndDownloadAllBibles(this.bible_list, false, callback); // just download if not exist, do not replace memory
            // }

            // save it
            this.dbHelper.putData(IndexedDBHelper.BIBLE_LIST, data); // let 'id' as default 1, because only 1 row

            // get all Bible from the list!
            this.parseBibleListAndDownloadAllBibles(this.bible_list, false, callback); // just download if not exist, do not replace memory
        });
    }

    async parseBibleListAndDownloadAllBibles(bible_list, is_replace_memory = true, callback) {
        // parse and check
        //log('total bible in current bible_list: ' + bible_list.bibles.length);

        const totalBibles = bible_list.bibles.length;
        log(`parseBibleListAndDownloadAllBibles(bible_list, ${is_replace_memory}, callback), total bible: ${totalBibles}`);

        let totalParsed = 0;
        for(let i = 0; i < totalBibles; i++) {
            this.parseAndDownloadSingleBible(bible_list.bibles[i], is_replace_memory, (data) => {
                totalParsed++;
                //log(`*** parseBibleListAndDownloadAllBibles(bible_list, ${is_replace_memory}, callback), downloaded ${totalParsed} of ${totalBibles}`);

                // 2024-10-04: on first Bible downloaded then set it as Main by default
                if(totalParsed == 1) {
                    this.saveMainBibleCode(data.code);
                }
        
                if(totalParsed == totalBibles) {
                    callback(totalParsed);
                }
            });
        }
    }

    async parseAndDownloadSingleBible(bible, is_replace_memory = true, callback) {
        const key = bible.locale + '_' + bible.code + '_' + bible.year;
        //log(`parseAndDownloadSingleBible(bible_list), key: ${key}`);

        // 1st load from DB
        const data = await this.dbHelper.getData(IndexedDBHelper.BIBLE_CONTENT, key);    
        if(data) {
            log(`parseAndDownloadSingleBible(bible, ${is_replace_memory}, callback), key: '${key}' existed in DB`);

            // 2024-09-30: check last_update_DT, if different then ALWAYS re-download !!
            // if(bible.last_update_DT != data.last_update_DT) THEN delete current stored value and MUST download !!!
            if(bible.last_update_DT != data.last_update_DT) {
                log(`parseAndDownloadSingleBible(bible, ${is_replace_memory}, callback), key: '${key}' is existed in DB, but last_update_DT [${bible.last_update_DT}] is different with [${data.last_update_DT}], so re-download it`);
                
                this.downloadASingleBibleContent(bible.download_url, key, async (data) => {
                    callback(data);
                });
            } else if(is_replace_memory) {
                // update into memory NOW then check last_update_DT, if different then redownload!
                this.saveBibleContentToMemory(data);

                // // RULE: compare the 'last_update_DT' (primary value to compare) if different then re-download it !!
                // if(bible.last_update_DT != data.last_update_DT) {
                //     log(`parseAndDownloadSingleBible(bible, ${is_replace_memory}, callback), key: '${key}' is existed in DB, but last_update_DT [${bible.last_update_DT}] is different with [${data.last_update_DT}], so re-download it`);
                    
                //     this.downloadASingleBibleContent(bible.download_url, key, async () => {
                //         callback();
                //     });
                // } else {
                //     callback();
                // }

                callback(data);
            } else {
                // same last_update_DT and do not replace memory, so just notify caller !
                callback(data);
            }
        } else {            
            log(`parseAndDownloadSingleBible(bible, ${is_replace_memory}, callback), key: '${key}' not exist in DB, so download it`);

            this.downloadASingleBibleContent(bible.download_url, key, async (data) => {
                callback(data);
            });
        }
    }

    downloadASingleBibleContent(download_url, key, callback) {
        // to prevent Google cache, add unique parameter
        const new_download_url = download_url + "?caller_time=" + (new Date().toISOString());

        this.download_JSON(new_download_url, async (data) => {
            log(`downloadASingleBibleContent(${new_download_url}) is downloaded`);

            await this.dbHelper.putData(IndexedDBHelper.BIBLE_CONTENT, data, key);

            // update to memory, if found then replace it
            this.saveBibleContentToMemory(data);

            callback(data);
        });
    }

    saveBibleContentToMemory(data) {
        // verify if this data is a valid OBF v2.0
        /*
        {
            "language": "English",
            "locale": "en",
            "name": "English Amplified Bible",
            "code": "AMP",
            "year": 2015,
            "description": "Open Bible Format v2.0 - jesoes.com",
            "last_update_DT": "2024-08-14 18:29:03",
            "books": [
        */
        // this line will be errror if there is a missing data
        const bible_signature = this.getBibleContentSignature(data);

        // avoid duplicate, so find if this data already exist?
        let foundIndex = -1;
        let total_bible_in_memory = this.loadedBibleContent.length;
        //log(`saveBibleContentToMemory(data), signature: ${bible_signature}, total bible in memory: ${total_bible_in_memory}`);

        for(let i = 0; i < total_bible_in_memory; i++) {
            
            const this_bible_signature = this.getBibleContentSignature(this.loadedBibleContent[i]);

            if(bible_signature == this_bible_signature) {
                //log(`saveBibleContentToMemory(data), [${bible_signature}] found at [${i}]`);
                foundIndex = i;
                break;
            }        
        }

        if(foundIndex < 0) {      
            //log(`saveBibleContentToMemory(data), [${bible_signature}] not found in memory, so add to it.`);
            
            // add into variable (memory)
            //bible_list.content.push(data);
            this.loadedBibleContent.push(data);        
        } else {
            //log(`saveBibleContentToMemory(data), [${bible_signature}] found in memory, so replace it at index ${foundIndex}`);
            //bible_list.content[foundIndex] = data;
            this.loadedBibleContent[foundIndex] = data;
        }
    }

    saveSelectedCurrentRead(bookNumber, chapterNumber, verseNumber) {
        log(`saveSelectedCurrentRead(${bookNumber}, ${chapterNumber}, ${verseNumber})`);
        localStorage.setItem("current_selected_read", JSON.stringify([bookNumber, chapterNumber, verseNumber]));
    }
    loadSelectedCurrentRead() {
        const val = localStorage.getItem("current_selected_read");
        if(val == null || val.length < 1) {
            log(`loadSelectedCurrentRead(), default [1,1,1]`);
            return [1,1,1]; // default
        } else {
            const numberArray = JSON.parse(val).map(Number);
            log(`loadSelectedCurrentRead(), ${numberArray}`);
            return numberArray; // return integer array
        }
    }

    getBibleContentSignature(data) {
        if (data == null) {
            log.error(`getBibleContentSignature(null), check here`);
            return;
        }
        return `${data.locale}, ${data.code}, ${data.year}, ${data.name}, ${data.last_update_DT}`;
    }

    // public function using closure
    getVerseText = (bookNumber, chapterNumber, verseNumber) => {
        return this.mainBibleContent.books[bookNumber - 1].chapters[chapterNumber - 1][verseNumber - 1];
    }

    getBookNumberName = (bookNumber) => {
        return this.mainBibleContent.books[bookNumber - 1].name;
    }

    static READ_HISTORY = "read_history";
    saveReadHistory(selectedBookNumber, selectedChapterNumber, selectedVerseNumber) {
        log(`saveReadHistory(${selectedBookNumber}, ${selectedChapterNumber}, ${selectedVerseNumber})`);

        // enforce numeric value
        selectedBookNumber = parseInt(selectedBookNumber);
        selectedChapterNumber = parseInt(selectedChapterNumber);
        selectedVerseNumber = parseInt(selectedVerseNumber);

        // check if any variable == null ?
        if (isNaN(selectedBookNumber) || isNaN(selectedChapterNumber) || isNaN(selectedVerseNumber) ||
            selectedBookNumber < 1 || selectedChapterNumber < 1 || selectedVerseNumber < 1) {
            error(`Invalid input to saveReadHistory(${selectedBookNumber}, ${selectedChapterNumber}, ${selectedVerseNumber})`);
            return;
        }

        // POLICY: do not allow duplicate.
        let savedReadHistory = this.loadReadHistory();

        // Remove duplicate entries more efficiently using findIndex and splice
        const duplicateIndex = savedReadHistory.findIndex(item =>
            item[0] === selectedBookNumber &&
            item[1] === selectedChapterNumber &&
            item[2] === selectedVerseNumber
        );

        if (duplicateIndex !== -1) {
            savedReadHistory.splice(duplicateIndex, 1);
        }

        // insert to the first (most recent)
        savedReadHistory.unshift([selectedBookNumber, selectedChapterNumber, selectedVerseNumber, new Date().toISOString()]);

        // 2024-10-02: found bug, fix it, limit array maximum 30
        savedReadHistory = savedReadHistory.slice(0, 30);

        // save
        localStorage.setItem(JesoesOBFManager.READ_HISTORY, JSON.stringify(savedReadHistory));
    }
    loadReadHistory() {
        let savedReadHistory = localStorage.getItem(JesoesOBFManager.READ_HISTORY);
        if(savedReadHistory) {
            try {
                savedReadHistory = JSON.parse(savedReadHistory);

                // More concise filtering using Array.isArray and destructuring
                let newSavedReadHistory = savedReadHistory.filter(item =>
                    Array.isArray(item) &&
                    item.length === 4 && // [book, chapter, verse, date]
                    !item.some(val => val === null) // Use .some() for a more efficient null check (compared to .every())
                );

                // is there any removal?
                if (savedReadHistory.length != newSavedReadHistory.length) {
                    // one or more item was removed, so update it
                    savedReadHistory = newSavedReadHistory;

                    // save
                    localStorage.setItem(JesoesOBFManager.READ_HISTORY, JSON.stringify(savedReadHistory));
                }
            } catch (e) {
                console.error("Error parsing or filtering read history:", e);
                savedReadHistory = [];

                // update, to avoid on next read error again !!
                localStorage.setItem(JesoesOBFManager.READ_HISTORY, JSON.stringify(savedReadHistory));
            }
        } else {
            savedReadHistory = [];
        }
        return savedReadHistory;
    }

    static MAIN_BIBLE_CODE = "main_bible_code";
    saveMainBibleCode(newMainBibleCode) {
        
        // check if this code exist ?
        let foundPos = -1;
        for(let i = 0; i < this.loadedBibleContent.length; i++) {
            if(this.loadedBibleContent[i].code.toLowerCase() == newMainBibleCode) {
                log(`saveMainBibleCode(${newMainBibleCode}), found at pos [${i}]`);
                foundPos = i;
                break;
            }
        }

        if(foundPos < 0) {
            log(`saveMainBibleCode(${newMainBibleCode}), NOT found`);
            return false; // failed
        }

        // replace
        this.mainBibleContent = this.loadedBibleContent[foundPos];

        // save
        localStorage.setItem(JesoesOBFManager.MAIN_BIBLE_CODE, newMainBibleCode);

        this.mainBibleCode = newMainBibleCode;

        return true;
    }
    loadMainBibleCode() {
        this.mainBibleCode = localStorage.getItem(JesoesOBFManager.MAIN_BIBLE_CODE);
        if(this.mainBibleCode == null || this.mainBibleCode.length < 1) {
            this.mainBibleCode = this.loadedBibleContent[0].code; // default is the first loaded bible 
        }
        log(`loadMainBibleCode() : ${this.mainBibleCode}`);
        return this.mainBibleCode;
    }

    static EXTRA_BIBLE_CODES = "extra_bible_codes";
    saveExtraBibleCodes(newExtraBibleCodes) {
        log(`saveExtraBibleCodes(${newExtraBibleCodes})`);

        // check if any of these codes not exist? if not exist delete !!
        let legalCodes = [];
        this.extraBibleContent = []; // reset

        for(let y = 0; y < newExtraBibleCodes.length; y++) {
            for(let i = 0; i < this.loadedBibleContent.length; i++) {
                if(this.loadedBibleContent[i].code.toLowerCase() == newExtraBibleCodes[y]) {

                    if(newExtraBibleCodes[y] != this.mainBibleCode) { // filter out main bible code
                        legalCodes.push(newExtraBibleCodes[y]);                    
                        log(`saveExtraBibleCodes(${newExtraBibleCodes}), found '${legalCodes}'`);
                    }

                    // update memory
                    this.extraBibleContent.push(this.loadedBibleContent[i]);
                    
                    break;
                }
            }
        }

        /* allow save empty [] extraBibleCodes ==> no translation */
        // if(legalCodes.length < 1) {
        //     log(`saveExtraBibleCodes(${newExtraBibleCodes}), nothing to save`);
        //     return false; // failed
        // }

        // save
        localStorage.setItem(JesoesOBFManager.EXTRA_BIBLE_CODES, JSON.stringify(legalCodes));

        this.extraBibleCodes = legalCodes;

        return true;
    }
    loadExtraBibleCodes() {
        this.extraBibleCodes = localStorage.getItem(JesoesOBFManager.EXTRA_BIBLE_CODES);
        if(this.extraBibleCodes == null || this.extraBibleCodes.length < 1) {
            this.extraBibleCodes = [];// default is none 
            return this.extraBibleCodes;
        }
        this.extraBibleCodes = JSON.parse(this.extraBibleCodes); // convert from string to array
        log(`loadExtraBibleCodes() : ${this.extraBibleCodes}`);
        return this.extraBibleCodes;
    }

    static SELECTED_TAB_BUTTON = "selected_tab_button";
    saveSelectedTabButton(tabButtonId) {
        localStorage.setItem(JesoesOBFManager.SELECTED_TAB_BUTTON, tabButtonId);
    }
    loadSelectedTabButton() {
        let savedTabButtonId = localStorage.getItem(JesoesOBFManager.SELECTED_TAB_BUTTON);
        if(savedTabButtonId == null || savedTabButtonId.length < 1) {
            return 'tab_radio_1'; // default CHOOSE tab
        }
        return savedTabButtonId;
    }
}