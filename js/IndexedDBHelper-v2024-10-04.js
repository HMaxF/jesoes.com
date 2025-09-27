/**
 * This is the class for managing simple indexedDB 
 * 
 * RULES:
 * 1. What putData(storeName, data, id = '1') will be return the same as getData(storeName, id = '1')
 * 2. Default id = '1', user can provide other value
 * 
 * History:
 * 2024-10-03:
 * - implement callback in open().onerror()
 * - in open.onerror() call to deleteDatabase, because there is no db connection yet so at this point we can delete database !!
 * 
 * 2024-09-15: first created.
 * 
 */

var log = log || console.log;

class IndexedDBHelper {

    // ECMAScript 2015 (ES6).
    static BIBLE_LIST = 'bible_list' ;
    //static BIBLE_STRUCTURE = 'bible_structure' ;
    static BIBLE_CONTENT = 'bible_content' ;

    // singleton
    static instance;

    constructor(dbName, version) {
        if(! IndexedDBHelper.instance) {
            // create new
            IndexedDBHelper.instance = this;
        } else {
            // already created, just return it
            return IndexedDBHelper.instance;
        }

        this.dbName = dbName;
        this.version = version;
        this.db = null; // To store the opened database instance

        return this;
    }
  
    async open(openErrorCallback) {
        if (this.db) {
            //log(`the database is already opened, return it`);
            return this.db;
        }

        this.onOpenErrorCallback = openErrorCallback;
          
        // Otherwise, open the database and store the reference
        this.db = await new Promise((resolve, reject) => {

            log(`trying to open()`);
            const request = indexedDB.open(this.dbName, this.version);
      
            request.onsuccess = (event) => {
                log(`open(), onsuccess, db is open successfully.`);
                resolve(event.target.result); // Store the opened DB instance
            };
      
            request.onerror = (event) => {
                log(`open(), onerror, error: ${event.target.error}.`);

                // 2024-10-03: maybe request version is lower than current version, why?
                // POLICY: just delete database and force user to retry
                this.deleteDatabase(this.dbName);

                if(this.onOpenErrorCallback) {
                    this.onOpenErrorCallback(event.target.error);
                }

                reject(event.target.error);
            };
      
            request.onupgradeneeded = (event) => {
                this.db = event.target.result;

                log(`open(), onupgradeneeded, current version: ${this.db.version}`);

                // delete all stores ("tables")
                this.deleteAllStores();

                /**
                 * AT this point we must create all stores
                 * NOTE: only at this point that store(s) can be created!!
                 */                
                //this.createAStore(IndexedDBHelper.BIBLE_STRUCTURE, 'id'); // only 1 record
                this.createAStore(IndexedDBHelper.BIBLE_LIST, 'id'); // only 1 record

                // multiple records, eg: 'id_tb_1974', 'id_bis_1985', 'id_vmd_2006', 'en_amp_2015', 'kr_aeb_1994', 'en_nwt_2013'
                this.createAStore(IndexedDBHelper.BIBLE_CONTENT, 'id'); 
            };
        });
      
        return this.db; // Return the opened database instance
    }

    /**
     * store == 'table'
     * keyPath: 'column' ==> 'column' is the primary key that must exist in 'data' in store.add(data)
     */
    createAStore(storeName, idName) {
        // check to prevent double create
        if (!this.db.objectStoreNames.contains(storeName)) {
            const store = this.db.createObjectStore(storeName, { keyPath: idName });
            log(`createAStore(${storeName}, ${idName}), created store name: ${store.name}`);
        }
    }

    deleteAllStores() {
        
        const storeNames = this.db.objectStoreNames;

        for (let i = storeNames.length - 1; i >= 0; i--) {
            this.db.deleteObjectStore(storeNames[i]);
        }

        log('All stores deleted successfully.');
    }

    /**
     * There is no way to delete stores (tables) when database is open, 
     * so try to delete database then recreate it.
     */
    deleteDatabase(dbName, callback) {
        log(`deleteDatabase(${dbName}, callback)`);
        
        // Open a connection to the database
        const request = indexedDB.deleteDatabase(dbName);

        request.onsuccess = function () {
            console.log(`Database '${dbName}' deleted successfully.`);
            
            if(callback) {
                callback();
            }
        };

        request.onerror = function () {
            console.error(`Error deleting database '${dbName}':`, request.error);

            if(callback) {
                callback();
            }
        };

        request.onblocked = function () {
            console.log(`Delete request is blocked for database '${dbName}'. Close any open connections.`);

            if(callback) {
                callback();
            }
        };        
    }
  
    // Add data to the object store
    async putData(storeName, data, id = 1) {
        log(`putData(${storeName}, ${(data == null ? 'null' : 'not null')}, ${id})`);

        // Ensure DB is open
        this.db = await this.open(() => {
            log(`putData(${storeName}, data, ${id}), callback is called`);
        }); 

        return new Promise((resolve, reject) => {
            // check if this store (table) exist?
            if(!this.db.objectStoreNames.contains(storeName)) {
                const err_msg = `putData(${storeName}, ${(data == null ? 'null' : 'not null')}, ${id}), storeName is not exist, must UPGRADE to create store!!`;
                //log(err_msg);                
                // error
                reject({"success": false, "err_msg" : err_msg});
                return;
            }

            const transaction = this.db.transaction(storeName, "readwrite");
            const store = transaction.objectStore(storeName);

            // add 'id' here, operation is transparent to caller
            const request = store.put({'id': id, 'data': data});

            request.onsuccess = () => {
                log(`putData(${storeName}, ${(data == null ? 'null' : 'not null')}, ${id}), succeed`);
                resolve({"success": true});
            }
            request.onerror = (event) => {
                reject({"success": false, "err_msg" : event.target.errorCode});
            }
        });
    }

    // Get data by key from the object store
    async getData(storeName, id = 1, onErrorCallback) {
        // Ensure DB is open
        this.db = await this.open((errorMsg) => {
            log(`getData(${storeName}, ${id}), errorMsg: ${errorMsg}`);

            if(onErrorCallback) {
                onErrorCallback(errorMsg);
            }
        }); 

        return new Promise((resolve, reject) => {

            // check if this store (table) exist?
            if(!this.db.objectStoreNames.contains(storeName)) {
                const err_msg = `getData(${storeName}, ${id}), storeName is not exist, must UPGRADE!!`;
                log(err_msg);
                
                // not an error
                //resolve({"success": false, "err_msg": err_msg});
                resolve(null);
                return;
            }

            const transaction = this.db.transaction(storeName, "readonly"); // store == "table"
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = (event) => {
                const result = event.target.result;

                if(result) {
                    // remove 'id', this is transparent to caller
                    const data = result.data;

                    //resolve({"success": true, "data": result});
                    resolve(data);
                } else {
                    // not an error
                    const err_msg = `getData(${storeName}, ${id}), data not found, check 'id' value`;
                    log(err_msg);
                    //resolve({"success": false, "err_msg": err_msg});
                    resolve(null);
                }
            }
            request.onerror = (event) => {
                reject(new Error(`getData(${storeName}, ${id}), error retrieving data: ${event.target.errorCode}`));

                if(onErrorCallback) {
                    onErrorCallback();
                }
            }
        });
    }
}
  
  