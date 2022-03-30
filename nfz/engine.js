const API_URL = "https://api.nfz.gov.pl/app-stat-api-jgp";
var links = {};
var keylist = [];
var yearlist = [];

async function nfzfetch(api_addr) {
    showLoading(true);
    let a = [];
    let obj;
    let next = api_addr;
    if(!next.startsWith("http")) next = API_URL + next;
    while(next != null) {
        obj = await fetch(next.replace("http:", "https:"))
            .then(response => response.json())
            .then(data => {return data});
        a.push(obj.data);
        if(obj.links) next = obj.links.next;
        else break;
    }
    showLoading(false);
    return a;
}

async function run() {
    let elem;
    var sections = [];
    var sectionDropdown = document.getElementById("sections");
    (await nfzfetch('/sections')).forEach(a => {sections = sections.concat(a)});
    sections.forEach(s => {
        elem = document.createElement("option");
        elem.value = s;
        elem.innerText = s;
        sectionDropdown.appendChild(elem);
    });

    sectionDropdown.addEventListener("input", onSectionChange);
    document.getElementById("submit").addEventListener("click", onSubmit);
    document.getElementById("overlay").addEventListener("click", hideCheckout);
    document.getElementById("checkout").addEventListener("click", ignore);
    document.getElementById("checkout-submit").addEventListener("click", generateData);

    onSectionChange({target: sectionDropdown});
    // console.log(sections);

    // var benefit = (await nfzfetch('/benefits?catalog=1a&section=' + "B - Choroby oczu"))[0][1].code;
    // console.log(benefit);
    // var index = (await nfzfetch('/index-of-tables?catalog=1a&name=' + benefit));
    // console.log(index);

    // var uid = "33323338-3137-5254-4850-503030303030";
    // var bid = "33323735-3334-5254-4150-503030303030";
    // var hosp = (await nfzfetch("/hospitalizations-by-healthcare-service/" + uid))
    // var bas = (await nfzfetch("/basic-data/" + bid))
    // console.log(hosp);
    // console.log(bas);

    // fetch('https://api.nfz.gov.pl/app-stat-api-jgp/index-of-tables?catalog=1a&section=' + section)
    //     .then(response => response.json())
    //     .then(data => console.log(data));
}

async function onSectionChange(e) {
    links = {};
    let section = e.target.value;
    let elem;
    let checkboxes = document.getElementById("benefit-checkboxes");
    checkboxes.innerHTML = "";
    let benefits = (await nfzfetch('/benefits?catalog=1a&section=' + section))
    for(a of benefits) {
        for(b of a) {
            addCheckbox(checkboxes, b.code, b.name);
        }
    }
}

async function onSubmit(e) {
    let benefits = [];
    let index, ident, key, tableset;
    let yearset = new Set();
    let keyset = new Set();
    let checkboxes = document.getElementById("benefit-checkboxes");
    for(let ch of checkboxes.children) {
        if(ch.tagName == "INPUT" && ch.checked) {
            benefits.push(ch.id);
        }
    }
    if(benefits.length == 0) {
        alert("Nothing chosen");
        return;
    }
    for(let b of benefits) {
        index = (await nfzfetch('/index-of-tables?catalog=1a&name=' + b))[0].attributes.years;
        for(let y of index) {
            yearset.add(y.year);
            tableset = new Set();
            for(let ref of y.tables) {
                ident = ref.attributes.header;
                // line above doesn't allow doubled tables in one benefit+year pair - they would be undistinguishable in the .csv
                if(!tableset.has(ident)) {
                    tableset.add(ident);
                    key = ident;
                    keyset.add(key);
                    addLink(links, y.year, key, ref.links.related)
                }
            }
        }
    }
    keylist = Array.from(keyset);
    keylist.sort();
    yearlist = Array.from(yearset);
    yearlist.sort();
    showCheckout();
}

function addLink(links, year, key, newlink) {
    if(!links[year]) links[year] = {};
    if(!links[year][key]) links[year][key] = [];
    links[year][key].push(newlink);
}

function addCheckbox(container, id, text, checked=false) {
    let elem = document.createElement("INPUT");
    elem.type = "checkbox";
    elem.id = id;
    elem.checked = checked;
    container.appendChild(elem);
    elem = document.createElement("LABEL");
    elem.htmlFor = id;
    elem.innerText = text;
    container.appendChild(elem);
    container.appendChild(document.createElement("BR"));
}

function showCheckout() {
    let years = document.getElementById("checkout-years");
    years.innerHTML = "";
    for(let year of yearlist) addCheckbox(years, "checkout-year-" + year, year, true);
    let tables = document.getElementById("checkout-tables");
    tables.innerHTML = "";
    for(let table of keylist) addCheckbox(tables, "checkout-table-" + table, table, true);
    // document.getElementById("chckout-option-comma").checked = true;
    document.getElementById("overlay").style.display = "block";
}

function hideCheckout(e) {
    document.getElementById("overlay").style.display = "none";
}

function ignore(e) {
    e.stopPropagation();
}

async function generateData(e) {
    let csv = "";
    let loc_links = JSON.parse(JSON.stringify(links));  // deep copy
    // let years = document.getElementById("checkout-years");
    // let tables = document.getElementById("checkout-tables");
    let yearCheckbox, tableCheckbox, dicts;
    let locYearList = [], locTableList = [];
    
    for(let year of yearlist) {
        yearCheckbox = document.getElementById("checkout-year-" + year);
        if(yearCheckbox && yearCheckbox.checked) locYearList.push("" + year);
    }
    for(let table of keylist) {
        tableCheckbox = document.getElementById("checkout-table-" + table);
        if(tableCheckbox && tableCheckbox.checked) locTableList.push("" + table);
    }
    // external dependencies cleared - segment below works 100% in its own scope
    for(let year in loc_links) {
        // yearCheckbox = document.getElementById("checkout-year-" + year);
        if(locYearList.includes(year)) {
            for(let table in loc_links[year]) {
                // tableCheckbox = document.getElementById("checkout-table-" + table);
                if(locTableList.includes(table)) {
                    for(let link of loc_links[year][table]) {
                        dicts = await extractData(link);
                        for(let dict of dicts) {
                            csv += csvRow(dict);
                        }
                    }
                }
            }
        }
    }
    downloadCSV(csv);
}

async function extractData(link) {
    let data = await nfzfetch(link);
    if(data.length < 1) return {};
    let base = {}, ret = [], dict;
    base.benefit = data[0].attributes.name;
    base.year = data[0].attributes.year;
    base.table = data[0].attributes.header;
    let probe = data[0].attributes.data;  // first data batch
    if(probe.length > 0) {
        let nameCol = null, codeCol = null;
        for(let key in probe[0]) {
            if(key.endsWith("name")) nameCol = key;
            else if(key.endsWith("code")) codeCol = key;
        }
        let hasData = probe[0]["number-of-hospitalizations"] ||
            probe[0]["percentage"] ||
            probe[0]["duration-of-hospitalization-mediana"];
            
        if(data.length == 1 && probe.length == 1 && !(nameCol && hasData)) {  // Data is basic (list of key-value pairs)
            for(let key in probe[0]) {
                if(isPrimitive(probe[0][key])) {  // data is not primitive => unable to put in CSV
                    ret.push({
                        name: key,
                        val: probe[0][key],
                        ...base
                    });
                } else {
                    errorHandle(0x30, "Data not primitive. Ommitting...", probe[0][key]);
                }
            }
        } else if(nameCol) {  // Data is complex
            for(let batch of data) {
                for(let record of batch.attributes.data) {
                    if(record[nameCol]) {
                        dict = {...base};
                        if(codeCol) dict.code = record[codeCol];
                        dict.name = record[nameCol];
                        dict.hosp = record["number-of-hospitalizations"];
                        dict.perc = record["percentage"];
                        dict.med = record["duration-of-hospitalization-mediana"];
                        ret.push(dict);
                    } else {
                        errorHandle(0x20, "Name not found in the record", record);
                    }
                    
                }
            }
        } else {  // Data not recognizable
            errorHandle(0x10, "Data not recognized", data);
        }
    }
    return ret;
}

const cols = ["benefit", "year", "table", "code", "name", "hosp", "perc", "med", "val"];
function csvRow(dict) {
    let ret = "", val;
    for(let i in cols) {
        if(i > 0) ret += ",";
        if(dict[cols[i]]) {
            val = dict[cols[i]];
            if(document.getElementById("chckout-option-comma").checked || typeof val == "number") {
                val = ("" + val).replace(".", ",");
            }
            ret += "\"" + val + "\"";
        }
    }
    return ret + "\n";
}

async function downloadCSV(csv) {
    csv = csvRow({
        benefit: "Benefit",
        year: "Rok",
        table: "Tabela",
        code: "Kod",
        name: "Nazwa",
        hosp: "Liczba hospitalizacji",
        perc: "Udzial procentowy",
        med: "Mediana dlugosci hospitalizacji",
        val: "Wartosc"
    }) + csv;
   
    let hiddenElement = document.createElement("a");
    hiddenElement.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
    hiddenElement.target = "_blank";
    
    //provide the name for the CSV file to be downloaded
    hiddenElement.download = "generated.csv";
    hiddenElement.click();
}

function errorHandle(code, desc, data) {
    console.log({
        errorCode: code,
        errorName: desc,
        data: data
    });
}

function isPrimitive(val) {
    if(!val) {  // null and undefined are primitive
        return true;
    } else if(val === Object(val)) {
        return false;
    } else {
        return true;
    }
}

function showLoading(loading) {
    let ld = document.getElementById("loading");
    if(loading) {
        ld.style.display = "block";
    } else {
        ld.style.display = "none";
    }
}

run();

