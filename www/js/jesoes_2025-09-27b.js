/**
 * This is the JS for new jesoes.com, this script only manage the UI and HTML logics!
 * 
 * Purpose:
 * 1. Promote my own OBF (Open Bible Format) v2.0 (JSON)
 *    - So other people can create the many Bible data and use for their own purposes.
 * 2. No database, for future without complicated hosting
 *    - All data is loaded from external JSON file (Google Cloud Storage) 
 * 3. New web design suitable for mobile/tablet/small screen
 * 4. Use cache in HTML5 indexedDB (no limit, localStorage limit max 5MiB)
 * 
 * TODO:
 * 1. Need to set CORS on Google Cloud Storage and allow only from https://jesoes.com !!
 *   * currently set to allow only from https://jesoes.com, https://www.gue2.com, and http://localhost:9090 (for development)
 * 2. Finish left menu "Choose Bible Translation" menu
 * 3. onExtraBibleChanged: set ordering by putting data-order="1", "2", "3", etc.
 * 
 * History:
 * 2024-09-29:
 * - Match new pattern of text inside [text] or {text}
 * 
 * 2024-09-22:
 * - GDPR compliant (cookie permission) is implemented
 * 
 * 2024-09-16:
 * - Bible Structure is embedded inside index.html 
 * - Load Bible List JSON --> then always download Bible List JSON (if failed then no error)
 * - Load Bible Content JSONs if loaded then compare the date with the latest Bible List
 * 
 * 2024-09-18:
 * - Separate this script and IndexedDBHelper.js
 * - Update these 2 variables when mainBibleContent (only 1 content) or extraBibleContent (array of content) is changed
 * - loadedBibleContent is an array for successfully loaded from database (or from download if DB is not used)
 * 
 * 2024-08-31: 
 * - first created.
 * 
 */

var log = log || console.log;
var error = error || console.error;

var eleMenuRight;
var eleMenuLeft;

// default
var selectedBookNumber = 1,
    selectedChapterNumber = 1,
    selectedVerseNumber = 1,
    selectedVerseToNumber = 0;

var jesoesOBFManager = null;

window.addEventListener('load', () => {
    log('loaded');

    // get the menu elements
    if(eleMenuLeft == null || eleMenuLeft == "undefined") {
        eleMenuLeft = document.getElementById("left_menu_container");
    }

    if(eleMenuRight == null || eleMenuRight == "undefined") {
        eleMenuRight = document.getElementById("right_menu_container");
    }

    //setTabButtonClickable();

    // 2024-09-16: bible_structure is in index.html (no need to download), ready to render!
    //downloadBibleStructure();
    //renderBibleStructure_v1(bible_structure);
    //renderBibleStructure_v2(bible_structure);

    // get bible list to see if need to download/update
    jesoesOBFManager = new JesoesOBFManager();
    jesoesOBFManager.loadBibleList(() => {
        log(`onload, loadBibleList() finished!`);

        // update Choose Bible Translation list in left menu
        updateBibleTranslationListInLeftMenu();        

        // load previous selected selectedBookNumber, selectedChapterNumber, selectedVerseNumber
        [selectedBookNumber, selectedChapterNumber, selectedVerseNumber] = jesoesOBFManager.loadSelectedCurrentRead();

        // populate content tab book name
        refreshBooknameList(selectedBookNumber);

        // does this web open with hash tag to read specific content?
        const hash = window.location.hash.substring(1); // Remove the '#'
        const params = new URLSearchParams(hash);
        const page = params.get('page');
        log('onload, hash page: ' + page);

        let tabId = '';
        if(page == 'read') {            
            tabId = 'tab_radio_2';//btn_tab_read';

            selectedBookNumber = parseInt(params.get('book')); // make sure it is a value (not string)
            selectedChapterNumber = parseInt(params.get('chapter'));
            selectedVerseNumber = parseInt(params.get('verse'));

            // are they all value value?
            if (selectedBookNumber >= 1 || selectedChapterNumber >= 1 || selectedVerseNumber >= 1) {
                displayReadContent(selectedBookNumber, selectedChapterNumber, selectedVerseNumber);
            } else {
                error(`error value in either [${selectedBookNumber}] or [${selectedChapterNumber}] or [${selectedVerseNumber}]`);
            }
            
            
        } else {
            // fill up the 'read' tab content
            displayReadContent(selectedBookNumber, selectedChapterNumber, selectedVerseNumber);
        }

        refreshPreviousTabContent();

        updateLabelsBasedOnMainBible();
    });

    document.querySelector('button#content-choose-go').addEventListener('click', () => {
        // something is wrong here, it seems like the value 'selectedBookNumber' never change

        // Quick Solution: to refresh from storage .. this fix the problem, but why ?
        [selectedBookNumber, selectedChapterNumber, selectedVerseNumber] = jesoesOBFManager.loadSelectedCurrentRead();
        //log(`Go button clicked, selected = ${selectedBookNumber} ${selectedChapterNumber}:${selectedVerseNumber}`);

        goRead(selectedBookNumber, selectedChapterNumber, selectedVerseNumber);
    })


    // // check GDPR
    // checkGDPR();

    tab_container = document.getElementById('my_radio_button_labels');
    //tab_containergetComputedStyle(document.documentElement).getPropertyValue('--navigation-height');

    updateDeviceScreenInfo();
    calculateStaticHeaderHeight_plus_tabContainer();

    listenToTabChange();

    displayWelcome();
});

function listenToTabChange() {
    /**
     * listen to tab change to solve JUMPING 'top' (scroll position) value :
     * 1. BACKUP new tab content's getBoundingClientRect().top [eg: document.getElementById('content-read-book-chapter-verse').getBoundingClientRect().top]
     * 2. switch to the new selected tab content
     * 3. RESTORE the new selected tab content's getBoundingClientRect().top [eg: document.getElementById('content-read-book-chapter-verse').getBoundingClientRect().top]
     */

    log(`listenToTabChange(), total tab button: ${document.querySelectorAll('label.tab-button').length}`);

    document.querySelectorAll('label.tab-button').forEach((tab_button) => {
        tab_button.addEventListener('click', (event) => {
            const newClickedTabLabel = event.target;
            const newClickedTabInput = document.querySelector(`input[id="${newClickedTabLabel.getAttribute('for')}"]`);            
            const currentHighlightedTabInput = document.querySelector('input[type="radio"].tab_radio:checked');

            log(`listenToTabChange(), ${currentHighlightedTabInput.id} -> ${newClickedTabInput.id}`);

            // BACKUP new tab content's getBoundingClientRect().top  
            const newClickedTabContent = document.getElementById(newClickedTabInput.dataset.contentId);
            const currentHighlightedTabContent = document.getElementById(currentHighlightedTabInput.dataset.contentId);

            log(`listenToTabChange(), clicked new tab content bounding top = ${newClickedTabContent.getBoundingClientRect().top}`);
            log(`listenToTabChange(), current highlighted tab content bounding top = ${currentHighlightedTabContent.getBoundingClientRect().top}`);

            // TODO: continue here to solve jumping scroll/top position after switching tab
            
            // backup the new clicked tab FOR FUTURE RESTORE
            jesoesOBFManager.saveSelectedTabButton(newClickedTabInput.id);
        });
    });

    // RESTORE previously selected tab button
    const savedSelectedTabButtonId = jesoesOBFManager.loadSelectedTabButton();
    document.getElementById(savedSelectedTabButtonId).checked = true; // make it selected
}

function updateDeviceScreenInfo() {
    // for debugging
    document.getElementById('device-screen-info').textContent = `${window.innerWidth}*${window.innerHeight}:${window.devicePixelRatio}`;
}
function calculateStaticHeaderHeight_plus_tabContainer() {
    // calculate
    staticHeaderHeight_plus_tabContainer = 2 * parseInt(getComputedStyle(document.body).getPropertyValue('--navigation-height').replace('px', ''));
}
window.addEventListener('resize', () => {
    updateDeviceScreenInfo();

    calculateStaticHeaderHeight_plus_tabContainer();
});

var tab_container = null;
window.addEventListener('scroll', () => {

    /**
     * make tab_container sticky if window.scrollY is > header 
     */

    //log(`scroll, '${window.scrollY}', '${tab_container.getBoundingClientRect().top}'`);

    // var(--navigation-height) is dynamic depend on screen width
    // do not hardcode the value
    // use '>=' instead of '>' to prevent stuterring
    if (window.scrollY >= tab_container.offsetHeight) { 
        // scrolled up, so make it sticky if not yet
        if(! tab_container.classList.contains('sticky')) {
            log(`'scroll', add sticky`);
            tab_container.classList.add('sticky');
        }
    } else {
        if(tab_container.classList.contains('sticky')) {
            log(`'scroll', remove sticky`);
            tab_container.classList.remove('sticky');
        }
    }
});

function updateBibleTranslationListInLeftMenu() {
    const menu = document.getElementById('bible_translation_selection_menu');
    const totalLoadedBibleInMemory = jesoesOBFManager.loadedBibleContent.length;

    const mainBibleCode = jesoesOBFManager.loadMainBibleCode().toLowerCase();
    const extraBibleCodes = jesoesOBFManager.loadExtraBibleCodes();
    log(`updateBibleTranslationListInLeftMenu(), main bible code: '${mainBibleCode}', extra '${extraBibleCodes}'`);

    let html = '';
    for(let i = 0; i < totalLoadedBibleInMemory; i++) {

        const loadedBible = jesoesOBFManager.loadedBibleContent[i];
        const bibleCode = loadedBible.code.toLowerCase();

        html += '<div>';

        // 2024-10-04: in my Android smartphone, the UI is broken if I put <label> then <input>, so go back to the original design <input> then <label>
        // radio button
        html += `<input type="radio" class="main_bible" id="bible_code_${bibleCode}" data-code="${bibleCode}" name="radio_main_bible" onchange="onMainBibleChanged();" ${(bibleCode == mainBibleCode ? 'checked' : '')}>`;

        // label
        html += `<label for="bible_code_${bibleCode}">${loadedBible.name} - ${loadedBible.year}</label>`;

        // checkbox
        html += `<input type="checkbox" class="extra_bible" data-code="${bibleCode}" name="cb_extra_bible" onchange="onExtraBibleChanged();" ${extraBibleCodes.includes(bibleCode) ? 'checked' : ''}>`;

        html += '</div>';
    }
    menu.innerHTML = html;
}

// function checkGDPR() {
//     const AGREED_TO_GDPR = 'agreed_to_gdpr';

//     const when_agreed_to_gdpr = localStorage.getItem(AGREED_TO_GDPR);
//     if(when_agreed_to_gdpr) {
//         log(`GDPR agreed on "${new Date(when_agreed_to_gdpr)}"`);
//     } else {
//         log(`GDPR has not been agreed, so display it`);
//         document.getElementById('gdpr-popup').classList.add('active');

//         document.querySelector('button#gdpr-accept').addEventListener('click', () => {
//             const nowISOString = new Date().toISOString();
//             log(`agreed to GDPR on ${nowISOString}`);

//             //save it
//             localStorage.setItem(AGREED_TO_GDPR, `${nowISOString}`);

//             document.getElementById('gdpr-popup').classList.remove('active');
//         });
//         document.querySelector('button#gdpr-decline').addEventListener('click', () => {            
//             log(`declined to GDPR`);

//             document.getElementById('gdpr-popup').classList.remove('active');
//         });
//     }
// }

function displayWelcome() {
    const UNDERSTOOD_INFORMATION = 'understood_information';

    const when_understood_to_information = localStorage.getItem(UNDERSTOOD_INFORMATION);
    if(when_understood_to_information) {
        log(`Information understood on "${new Date(when_understood_to_information)}"`);
    } else {
        log(`Information has not been understood, so show it`);
        document.getElementById('popup-welcome-and-agreement').classList.add('active');

        document.querySelector('button#info-understand').addEventListener('click', () => {
            const nowISOString = new Date().toISOString();
            log(`Understand information on ${nowISOString}`);

            //save it
            localStorage.setItem(UNDERSTOOD_INFORMATION, `${nowISOString}`);

            document.getElementById('popup-welcome-and-agreement').classList.remove('active');
        });
        document.querySelector('button#info-show-again').addEventListener('click', () => {            
            log(`show information again later`);

            document.getElementById('popup-welcome-and-agreement').classList.remove('active');
        });
    }
}

function goRead(selectedBookNumber, selectedChapterNumber, selectedVerseNumber) {
    log(`goRead(${selectedBookNumber}, ${selectedChapterNumber}, ${selectedVerseNumber})`);

    jesoesOBFManager.saveReadHistory(selectedBookNumber, selectedChapterNumber, selectedVerseNumber);
    refreshPreviousTabContent();

    document.getElementById('tab_radio_2').click();

    // change hash
    window.location.hash = `page=read&book=${selectedBookNumber}&chapter=${selectedChapterNumber}&verse=${selectedVerseNumber}`;
}

function refreshPreviousTabContent() {
    // fill up the 'previous' tab
    const loadedReadHistory = jesoesOBFManager.loadReadHistory();

    let html = '';
    for(let i = 0; i < loadedReadHistory.length; i++) {
        let [loadedBookNumber, loadedChapterNumber, loadedVerseNumber, loadedDate] = loadedReadHistory[i];
        
        let formattedDate = '';
        if(loadedDate) {
            // MUST NOT use string operation because incorrect TIMEZONE !!
            // formattedDate = loadedDate.split('T');
            // formattedDate = `${formattedDate[0]} ${formattedDate[1].substr(0,5)}`; // YYYY-MM-DD HH:mm

            formattedDate = formatDateTime(loadedDate);
        }        

        html += `<div data-book="${loadedBookNumber}" data-chapter="${loadedChapterNumber}" data-verse="${loadedVerseNumber}">
            <span>[${formattedDate}]</span> <span>${jesoesOBFManager.getBookNumberName(loadedBookNumber)} ${loadedChapterNumber}:${loadedVerseNumber}</span>
            ${jesoesOBFManager.getVerseText(loadedBookNumber, loadedChapterNumber, loadedVerseNumber)}
            </div>`;
    }

    const ele = document.getElementById('content-read-history-list');
    ele.innerHTML = html;

    // make each item clickable
    ele.querySelectorAll('#content-read-history-list div').forEach((item) => {
        item.addEventListener('click', (event) => {
            //const clickedItem = event.target; // NOTE: event.target could be <span> or other child
            const clickedItem = event.currentTarget; // NOTE: event.currentTarget always <div>

            if (Object.keys(clickedItem.dataset).length === 0) {
                error(`dataset is empty`);
                return;
            } else {
                selectedBookNumber = clickedItem.dataset.book;
                selectedChapterNumber = clickedItem.dataset.chapter;
                selectedVerseNumber = clickedItem.dataset.verse;
            }

            log(`previous tab, clicked item: book=${selectedBookNumber}, chapter=${selectedChapterNumber}, verse=${selectedVerseNumber}`);

            goRead(selectedBookNumber, selectedChapterNumber, selectedVerseNumber);
        })
    });
}

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1); // Remove the '#'
    const params = new URLSearchParams(hash);

    const page = params.get('page');
    log('hashchange, page: ' + page);

    let tabId = '';
    if(page == 'choose') {
        // DO NOT perform click other 'hashchange' will be triggerred again
        // instead call the wrapper
        //tabAction('btn_tab_choose');
        tabId = 'tab_radio_1';//btn_tab_choose';
    } else if(page == 'read') {
        // DO NOT perform click other 'hashchange' will be triggerred again
        // instead call the wrapper
        //tabAction('btn_tab_read');
        tabId = 'tab_radio_2';//btn_tab_read';

        if(parseInt(selectedBookNumber) < 1 || parseInt(selectedChapterNumber) < 1 || parseInt(selectedVerseNumber) < 1) {
            error(`Fixed error value [${selectedBookNumber}] or [${selectedChapterNumber}] or [${selectedVerseNumber}]`);
            selectedBookNumber = 1;
            selectedChapterNumber = 1;
            selectedVerseNumber = 1;
        }

        displayReadContent(selectedBookNumber, selectedChapterNumber, selectedVerseNumber);
    } else {
        // previous history of selectedBookNumber, selectedChapterNumber and selectedVerseNumber

        //tabAction('btn_tab_previously');
        tabId = 'tab_radio_3';//btn_tab_previously';
    }

    //updateActiveTab(tabId); // update active tab
});

function formatDateTime(loadedDate) {

    function get2Digit(val) {
        return (val < 10 ? '0' + val : val);
    }

    const newDate = new Date(loadedDate);
    let formatted = `${newDate.getFullYear()}-${get2Digit(newDate.getMonth())}-${get2Digit(newDate.getDate())} ${get2Digit(newDate.getHours())}:${get2Digit(newDate.getMinutes())}`;
    return formatted;
}

function refreshBooknameList(selectedBookNumber) {
    // update 'content-choose' book name list

    if(! jesoesOBFManager.mainBibleContent) {
        log(`refreshBooknameList(${selectedBookNumber}), mainBibleContent is not defined`);
        return;
    }

    let html = '';
    const totalBook = jesoesOBFManager.mainBibleContent.books.length;
    for(let i = 0; i < totalBook; i++) {
        // TODO: how to add label 'New Testament' and 'Old Testament' if using <li>?
        html += `<li data-id="${i + 1}">${jesoesOBFManager.mainBibleContent.books[i].name}</li>`;
    }    
    document.querySelector('#choose-booknames-list').innerHTML = html;

    document.querySelectorAll('ul#choose-booknames-list li').forEach((item) => {
        item.addEventListener('click', (event) => {
            const thisItem = event.target;

            // remove 'selected' if not the same item
            const selectedItem = thisItem.parentElement.querySelector('li.selected');
            if(selectedItem && selectedItem == thisItem) {
                log(`refreshBooknameList(${selectedBookNumber}), clicked on the same selected item ${selectedItem.dataset.id}, do nothing`);
            } else {
                // different item, so de-select it
                selectedItem.classList.remove('selected');

                // only set this item 'selected'
                thisItem.classList.add('selected');

                // update
                selectedBookNumber = parseInt(thisItem.dataset.id)

                refreshChapterList(selectedBookNumber);
            }
        });
    });

    // update UI

    const item = document.querySelector(`ul#choose-booknames-list li[data-id="${selectedBookNumber}"]`);
    item.classList.add('selected');
    scrollIntoViewOfThisElement(item);

    // update chapter list
    refreshChapterList(selectedBookNumber);
}

function refreshChapterList(selectedBookNumber) {
    // update chapter list by get bookId and list 1~n items
    const totalChapterThisBook = jesoesOBFManager.mainBibleContent.books[selectedBookNumber - 1].chapters.length;

    log(`refreshChapterList(${selectedBookNumber}), total chapter: ${totalChapterThisBook}`);

    let html = '';
    for(let i = 0; i < totalChapterThisBook; i++) {
        html += `<li data-id="${i + 1}">${i + 1}</li>`;
    }

    const ele = document.querySelector('ul#choose-chapter-number-list');    
    ele.innerHTML = html;

    // make them all clickable
    document.querySelectorAll('ul#choose-chapter-number-list li').forEach((item) => {        
        item.addEventListener('click', (event) => {
            const thisItem = event.target;

            // remove 'selected' if not the same item
            let selectedItem = thisItem.parentElement.querySelector('li.selected');

            // check if selectedItem has proper value?
            if (selectedItem === null || parseInt(selectedItem) < 1) {
                // wrong value, so set the first chapter
                selectedItem = 1;
            }

            if(thisItem == selectedItem) {
                log(`refreshChapterList(${selectedBookNumber}), clicked on the same selected item ${selectedItem.dataset.id}, do nothing`);
            } else {
                // different item, so de-select it
                selectedItem.classList.remove('selected');

                // only set this item 'selected'
                thisItem.classList.add('selected');

                // update
                selectedChapterNumber = parseInt(thisItem.dataset.id)

                refreshVerseList(selectedBookNumber, selectedChapterNumber);
            }
        });
    });
    
    // update UI
    if(totalChapterThisBook < selectedChapterNumber) {
        // limit
        selectedChapterNumber = totalChapterThisBook;
    }
    const item = document.querySelector(`ul#choose-chapter-number-list li[data-id="${selectedChapterNumber}"]`);
    item.classList.add('selected');
    scrollIntoViewOfThisElement(item);

    // update verse list
    refreshVerseList(selectedBookNumber, selectedChapterNumber);
}
function refreshVerseList(selectedBookNumber, selectedChapterNumber) {
    // update chapter list by get bookId and list 1~n items
    const totalVerseThisChapter = jesoesOBFManager.mainBibleContent.books[selectedBookNumber - 1].chapters[selectedChapterNumber - 1].length;

    log(`refreshVerseList(${selectedBookNumber}, ${selectedChapterNumber}), total verse: ${totalVerseThisChapter}`);

    let html = '';
    for(let i = 0; i < totalVerseThisChapter; i++) {
        html += `<li data-id="${i + 1}">${i + 1}</li>`;
    }

    const ele = document.querySelector('ul#choose-verse-number-list');
    ele.innerHTML = html;

    // make them all clickable
    document.querySelectorAll('ul#choose-verse-number-list li').forEach((item) => {
        item.addEventListener('click', (event) => {
            const thisItem = event.target;

            // remove 'selected' if not the same item
            const selectedItem = thisItem.parentElement.querySelector('li.selected');
            if(thisItem == selectedItem) {
                log(`refreshVerseList(${selectedBookNumber}, ${selectedChapterNumber}), clicked on the same selected item ${selectedItem.dataset.id}, do nothing`);
            } else {
                // different item, so de-select it
                selectedItem.classList.remove('selected');

                // only set this item 'selected'
                thisItem.classList.add('selected');

                // update
                selectedVerseNumber = parseInt(thisItem.dataset.id)

                setVerseText(selectedBookNumber, selectedChapterNumber, selectedVerseNumber);
            }
        });
    });

    if(parseInt(selectedVerseNumber) >= 1) {
        if(totalVerseThisChapter < selectedVerseNumber) {
            // limit
            selectedVerseNumber = totalVerseThisChapter;
        } 
    } else {
        // invalid value or no value, so set the first verse
        selectedVerseNumber = 1;
    }

    const item = document.querySelector(`ul#choose-verse-number-list li[data-id="${selectedVerseNumber}"]`);
    item.classList.add('selected');
    scrollIntoViewOfThisElement(item);

    // display verse
    setVerseText(selectedBookNumber, selectedChapterNumber, selectedVerseNumber);
}

function setVerseText(selectedBookNumber, selectedChapterNumber, selectedVerseNumber) {

    const verseText = jesoesOBFManager.getVerseText(selectedBookNumber, selectedChapterNumber, selectedVerseNumber);
    log(`setVerseText(${selectedBookNumber}, ${selectedChapterNumber}, ${selectedVerseNumber}): ${verseText}`);

    // set UI
    document.querySelector('#content-choose-verse-text').innerHTML = `<em>${jesoesOBFManager.getBookNumberName(selectedBookNumber)} ${selectedChapterNumber}:${selectedVerseNumber}</em> ${verseText}`;

    // this is the only time to save
    jesoesOBFManager.saveSelectedCurrentRead(selectedBookNumber, selectedChapterNumber, selectedVerseNumber)

    return verseText;
}

function onMainBibleChanged() {
    var el = document.querySelector('input[type="radio"].main_bible:checked');
    log(`onMainBibleChanged(), selected: ${el.dataset.code}`); 

    // TODO:
    // 1. save to local storage    
    // 2. disable checkbox of this radio button

    const isSuccess = jesoesOBFManager.saveMainBibleCode(el.dataset.code);
    if(isSuccess) {

        // 2024-10-04: update the tab label
        updateLabelsBasedOnMainBible();        

        // update 'Choose' tab content
        refreshBooknameList(selectedBookNumber);

        // update 'Read' tab content        
        displayReadContent(selectedBookNumber, selectedChapterNumber, selectedVerseNumber);

        // update 'Previous' tab content
        refreshPreviousTabContent();
    }

    // enable all other checkboxes
    document.querySelectorAll(`input[type="checkbox"].extra_bible`).forEach((checkbox) => {
        checkbox.disabled = false;
    })

    // disable and remove this code from extra bible codes
    const checkbox = document.querySelector(`input[type="checkbox"][data-code="${el.dataset.code}"].extra_bible`);
    if(checkbox) {
        checkbox.checked = false;
        checkbox.disabled = true;
    }

    // trigger onExtraBibleChanged() to refresh
    onExtraBibleChanged();
}

function onExtraBibleChanged() {
    // query which checkboxes are checked?
    var els = document.querySelectorAll('input[type="checkbox"].extra_bible:checked');

    // 20241003: TODO: set ordering by putting data-order="1", "2", "3", etc.
        
    let extraBibleCodes = [...els].reduce((accumulator, currentValue) => {        
        accumulator.push(currentValue.dataset.code);
        return accumulator;
    }, []);
    log(`onExtraBibleChanged(), total extra bible: ${els.length}: ${extraBibleCodes}`);

    const isSuccess = jesoesOBFManager.saveExtraBibleCodes(extraBibleCodes);
    if(isSuccess) {
        // update 'Read' tab content
        displayReadContent(selectedBookNumber, selectedChapterNumber, selectedVerseNumber);
    }

    // TODO: how to make it first in first display?
    // because with this query, the top is always 'TB' then 'BIS' then 'VMD' etc.
}

function updateLabelsBasedOnMainBible() {
    const mainBibleCode = jesoesOBFManager.mainBibleContent.locale;

    log(`updateLabelsBasedOnMainBible(): ${mainBibleCode}`);

    if(mainBibleCode == 'en') {
        // English
        document.getElementById('label-tab-choose').textContent = 'Choose';
        document.getElementById('label-tab-read').textContent = 'Read';
        document.getElementById('label-tab-previous').textContent = 'Previous';

        // update "Choose" tab sub-title
        document.getElementById('header-label-book').textContent = 'Book';
        document.getElementById('header-label-chapter').textContent = 'Chapter';
        document.getElementById('header-label-verse').textContent = 'Verse';
    } else if(mainBibleCode == 'id') {
        // Indonesian
        document.getElementById('label-tab-choose').textContent = 'Pilih';
        document.getElementById('label-tab-read').textContent = 'Baca';
        document.getElementById('label-tab-previous').textContent = 'Sebelumnya';

        // update "Choose" tab sub-title
        document.getElementById('header-label-book').textContent = 'Buku';
        document.getElementById('header-label-chapter').textContent = 'Pasal';
        document.getElementById('header-label-verse').textContent = 'Ayat';
    } else if(mainBibleCode == 'kr') {
        // Korean
        document.getElementById('label-tab-choose').textContent = '선택';
        document.getElementById('label-tab-read').textContent = '읽기';
        document.getElementById('label-tab-previous').textContent = '기록'; // 이전 // 역사

        // update "Choose" tab sub-title
        document.getElementById('header-label-book').textContent = '책';
        document.getElementById('header-label-chapter').textContent = '장';
        document.getElementById('header-label-verse').textContent = '절';
    }
}

/*********************************************************
 *** BELOW IS GUI related code, eg: menus and tabs *******
 *** ONLY menu and tab animation, not managing content ***
 *********************************************************/

function updateActiveTab(tabRadioId) {
    /**
     * only change tab element UI, no business logic
     * 
     * This function will be called from 'Choose' and 'Previously' tabs to go to 'Read' tab!
     */
    // function wrapper to do action WITHOUT click event
    // const newActiveTab = document.querySelector('#' + tabId);

    // log(`updateActiveTab(${tabId})`);

    // // const targetId = tab.dataset.target;
    // // const tabContent = document.getElementById(targetId);

    // // Remove active class from all tabs and contents
    // const tabs = document.querySelectorAll('.tab-button');
    // const contents = document.querySelectorAll('.tab-content');

    // tabs.forEach(t => t.classList.remove('active'));
    // contents.forEach(c => c.classList.remove('active'));

    // // Add active class to clicked tab and its corresponding content
    // // tab.classList.add('active');
    // // tabContent.classList.add('active');
    // newActiveTab.classList.add('active');
    // document.getElementById(newActiveTab.dataset.target).classList.add('active');

    log(`updateActiveTab(${tabRadioId})`);
    document.getElementById(tabRadioId).checked = true;

    // just in case, close any open menu
    onCloseAllMenus();

    // Adjust the height of the container equal the height of the current content
    // this is to avoid vertical scroll showing on small content
    //setTabContentHeight();
}

function onCloseAllMenus() {

    // re-enable body -> to scroll
    document.body.classList.remove('hide');

    // check which menu is active, maybe there is none
    if(eleMenuLeft.classList.contains('active')) {
        // left menu is active            
        eleMenuLeft.classList.remove('active');
    } else if(eleMenuRight.classList.contains('active')) {
        // right menu is active
        eleMenuRight.classList.remove('active');
    }
}

function toggleMenu(menu) {
    menu.classList.toggle('active');

    if (menu.classList.contains('active')) {    
        // prevent body scroll            
        document.body.classList.add('hide');
    } else {
        document.body.classList.remove('hide');
    }

    // close the other menu
    if(menu == eleMenuLeft) {
        eleMenuRight.classList.remove('active');
    } else {
        eleMenuLeft.classList.remove('active');
    }
}

function displayReadContent(selectedBookNumber, selectedChapterNumber, selectedVerseNumber, selectedToVerseNumber = 0) {
    const msg = `displayReadContent(${selectedBookNumber}, ${selectedChapterNumber}, ${selectedVerseNumber}, ${selectedToVerseNumber})`;
    log(msg);

    const ele = document.getElementById('content-read-book-chapter-verse');
    ele.textContent = msg;

    let isParamCorrect = true;

    // Add checks for valid book, chapter, and verse numbers
    const books = jesoesOBFManager.mainBibleContent.books;
    if (!books) {
        error(`FATAL ERROR: books not exist!`);
        return;
    } else if(selectedBookNumber < 1) {
        error(`Invalid book number: ${selectedBookNumber}`);
        
        // so set default selectedBookNumber = 1
        selectedBookNumber = 1;

        isParamCorrect = false;
    } else if(selectedBookNumber > books.length) {
        error(`Invalid book number: ${selectedBookNumber}, going to set to max ${books.length}`);
        
        // set maximum
        selectedBookNumber = books.length;

        isParamCorrect = false;
    }

    // check if selectedChapterNumber is in proper range
    const chapters = books[selectedBookNumber - 1].chapters;
    if (! chapters) {
        error(`FATAL ERROR: chapters not exist!`);
        return;

    } else if(selectedChapterNumber < 1) {
        error(`Invalid chapter number: ${selectedChapterNumber}`);
        
        // so set default selectedChapterNumber = 1
        selectedChapterNumber = 1;

        isParamCorrect = false;
    } else if(selectedChapterNumber > chapters.length) {
        error(`Invalid chapter number: ${selectedChapterNumber}, going to set to max ${chapters.length}`);

        // set maximum
        selectedChapterNumber = chapters.length;

        isParamCorrect = false;
    }

    // check if selectedVerseNumber is in proper range
    const maxVerseNumber = chapters[selectedChapterNumber - 1].length;
    if (selectedVerseNumber < 1) {
        error(`Invalid verse number: ${selectedVerseNumber}`);
        selectedVerseNumber = 1; 

        isParamCorrect = false;
    } else if(selectedVerseNumber > maxVerseNumber) {
        error(`Invalid verse number: ${selectedVerseNumber}, going to set to max ${maxVerseNumber}`);
        // set maximum
        selectedVerseNumber = maxVerseNumber;

        isParamCorrect = false;
    }

    if(!isParamCorrect) {
        log('param incorrect, so update the URL');

        location.hash = `page=read&book=${selectedBookNumber}&chapter=${selectedChapterNumber}&verse=${selectedVerseNumber}`;
        
        // NOTE: the event 'hashchange' will not be trigger !!

        // continue progress
    }

    let html = `<h3>${jesoesOBFManager.getBookNumberName(selectedBookNumber)} ${selectedChapterNumber}:${selectedVerseNumber}</h3>`;

    const chapter = jesoesOBFManager.mainBibleContent.books[selectedBookNumber - 1].chapters[selectedChapterNumber - 1];
    const totalVerse = chapter.length;

    // detect Pericope '{Hello} how are you?', return: array ["{Hello} how are you?", "{Hello}", " how are you?"]
    //const pattern = /(\{.*?\})(.*)/;
    
    // about JS pattern, ChatGPT provide better solution than Gemini !!
    //const pattern = /(\{.*?\}|\[.*?\])/;
    //'{hello} how are [you]? do you {know} what [time] is it?'.split(/(\{.*?\}|\[.*?\])/).filter(Boolean);

    html += '<div id="content-verse-text-list-container">';
    for(let i = 0; i < totalVerse; i++) {
        //const matches = chapter[i].match(pattern);
        // if(matches && matches.length == 3) {
        //     // found pericope
        //     //html += `<details><summary><em>${i + 1}</em> <span>${matches[1]}</span> ${matches[2]}</summary>`;
        //     html += `<details><summary><span>${matches[1]}</span> ${matches[2]}</summary>`;
        // } else {
        //     // no pericope
        //     //html += `<details><summary><em>${i + 1}</em> ${chapter[i]}</summary>`;
        //     html += `<details><summary>${chapter[i]}</summary>`;
        // }
        
        html += `<details><summary>${styleText(chapter[i])}</summary>`;        

        // at this point, show the translation
        //if(jesoesOBFManager.extraBibleContent && jesoesOBFManager.extraBibleContent.length > 0) {
            for(let j = 0; j < jesoesOBFManager.extraBibleContent.length; j++) {

                // 2024-10-02 - IMPORTANT NOTE: this if() will detect if verse is missing then will skip (no <div>)
                // there is no crash, already checked using AMP and AMPC (missing verses = Mark 9:44 + 9:46 and 3 John 1:15)
                if(jesoesOBFManager.extraBibleContent[j].books[selectedBookNumber - 1].chapters[selectedChapterNumber - 1][i]) {

                    let extraVerse = jesoesOBFManager.extraBibleContent[j].books[selectedBookNumber - 1].chapters[selectedChapterNumber - 1][i];
                    html += `<div>${styleText(extraVerse)}</div>`;
                }
            }
        //}

        html += '</details>';
    }
    html += '</div>';

    ele.innerHTML = html;

    // make sure the specific verse is visible on screen !!
    //ele.querySelector(`details:nth-child(${selectedVerseNumber - 1})`);
    const selectedVerse = ele.querySelector(`#content-verse-text-list-container details:nth-child(${selectedVerseNumber})`);
    selectedVerse.classList.add('details-verse-highlighted');
    scrollIntoViewOfThisElement(selectedVerse);
}

// about JS pattern, ChatGPT provide better solution than Gemini !!
//const pattern = /(\{.*?\}|\[.*?\])/;
const pattern = /(\{.*?\}|\[.*?\]|\(.*?\))/; // catch {}, [], and ()
//'{hello} how are [you]? do you {know} what [time] is it?'.split(/(\{.*?\}|\[.*?\])/).filter(Boolean);
function styleText(text) {
    

    let html = '';
    const matches = text.split(pattern).filter(Boolean);
    matches.forEach((token, index) => {
        if (token.startsWith('{')
            || token.startsWith('[')
            || token.startsWith('(')
            ) {
            html += `<span>${token}</span>`;
        } else {
            html += token;
        }
    });
    return html;
}

let staticHeaderHeight_plus_tabContainer = 0;
function scrollIntoViewOfThisElement(el) {
    /* due to static header, to view element without being obstructed */
    //el.scrollIntoView({ behavior: 'smooth' }); /* does not count static header */

    const targetOffset = el.offsetTop - staticHeaderHeight_plus_tabContainer;
    window.scrollTo({top: targetOffset, behavior: 'smooth'});
}