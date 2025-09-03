const risksAPI = "/api/risks",
      showAllBtn = document.getElementById("showAllBtn"),
      addNewRiskBtn = document.getElementById("addNewRiskBtn"),
      searchRisk = document.getElementById("searchRisk"),
      searchRiskBtn = document.getElementById("searchRiskBtn"),
      clearSearchBtn = document.getElementById("clearSearchBtn"),
      cancelBtn = document.getElementById("formCancelBtn"),
      risksTableBody = document.getElementById("risksTableBody"),
      riskFormContainer = document.getElementById("riskFormContainer"),
      riskForm = document.getElementById("riskForm"),
      severityMin = document.getElementById("severityMin"),
      severityMax = document.getElementById("severityMax"),
      filterBtn = document.getElementById("filterBtn"),
      clearFilterBtn = document.getElementById("clearFilterBtn");

// riskForm fields
const riskID = document.getElementById("riskID"),
      riskName = document.getElementById("riskName"),
      riskDes = document.getElementById("riskDes"),
      riskSeverity = document.getElementById("riskSeverity");

// Showing all the risks
showAllBtn.onclick = () => renderRisks();

// Searching a risk
searchRiskBtn.onclick = () => {
    const idVal = parseInt(searchRisk.value.trim());

    if (isNaN(idVal)) {
        alert("Please enter a valid ID");
        return;
    }

    renderRisks({id: idVal});
};

clearSearchBtn.onclick = () => {
    searchRisk.value = ""; 
    renderRisks();         
}

// Showing add risk form
addNewRiskBtn.onclick = () => {
    riskForm.reset();
    riskID.value = 0;
    riskFormContainer.style.display = "block";
};

// Showing edit risk form
async function showEditForm(id) {
    try {
        const response = await fetch(`${risksAPI}/${id}`);
        if (!response.ok) return alert("Risk not found");

        const r = await response.json();

        riskID.value = r.riskID; 
        riskName.value = r.riskName;
        riskDes.value = r.riskDes;
        riskSeverity.value = r.riskSeverity;

        riskFormContainer.style.display = "block";
    } 
    catch (err) {
        console.error(err);
    }
}

cancelBtn.onclick = () => {
    riskFormContainer.style.display = "none";
};

// Submitting add or edit risk form
riskForm.onsubmit = async (submitEvent) => {
    submitEvent.preventDefault();

    const id = parseInt(riskID.value);

    // Creating a JS object from the form data
    const payload = {
        riskName: riskName.value,
        riskDes: riskDes.value,
        riskSeverity: parseInt(riskSeverity.value)
    };

    try {
        if (id === 0) {
            // Adding a new risk
            await fetch(risksAPI, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } 
        else {
            // Updating a risk
            await fetch(`${risksAPI}/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        riskFormContainer.style.display = "none";
        renderRisks();
    } 
    catch (err) {
        console.error(err);
        alert("Error saving risk"); 
    }
};

// Getting filtered risks
filterBtn.onclick = () => {
    const minVal = parseInt(severityMin.value);
    const maxVal = parseInt(severityMax.value);

    if(isNaN(minVal) || isNaN(maxVal)){
        alert("Please enter valid min and max values");
        return;
    }

    renderRisks({min: minVal, max: maxVal});
};

clearFilterBtn.onclick = () => {
    severityMin.value = ""; 
    severityMax.value = ""; 
    renderRisks();          
}


// Deleting a risk
async function deleteRisk(id) {
    if (!confirm("Are you sure you want to delete this risk?")) return;

    try {
        const res = await fetch(`${risksAPI}/${id}`, { method: "DELETE" });
        if (!res.ok) return alert("Risk not found");

        renderRisks();
    } 
    catch (err) {
        console.error(err);
    }
}

// Fetching and rendering risks
async function fetchRisks({ id = null, min = null, max = null } = {}) {
    try {
        let url = risksAPI;

        if(id !== null) {
            url += `/${id}`;
        } 
        else if(min !== null && max !== null) {
            url += `/filtered?min=${min}&max=${max}`;
        }

        const response = await fetch(url);
        
        if (!response.ok) 
            throw new Error("No risks found");

        const data = await response.json();
        
        if (Array.isArray(data))
            return data
        else
            return [data]
    } 
    catch(err) {
        console.error(err);
        return [];
    }
}

async function renderRisks(options = {}) {
    const risksArray = await fetchRisks(options);
    risksTableBody.innerHTML = "";

    risksArray.forEach(r => {
        const newTableRow = document.createElement("tr");
        newTableRow.innerHTML = `
            <td>${r.riskID}</td>
            <td>${r.riskName}</td>
            <td>${r.riskDes}</td>
            <td>${r.riskSeverity}</td>
            <td>
                <input type="button" value="Edit" onclick="showEditForm(${r.riskID})">
                <input type="button" value="Delete" onclick="deleteRisk(${r.riskID})">
            </td>
        `;
        risksTableBody.appendChild(newTableRow);
    });
}

// Initialization
renderRisks();
