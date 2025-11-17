// WORDS data moved to `words.js` (shared file)

// State to store selected packs
const packsState = {
  selectedPacks: [],
};

// Initialize pack selection
function initPackSelection() {
  const packOptions = document.getElementById("packOptions");
  packOptions.innerHTML = "";
  const packNames = Object.keys(WORDS);
  
  packNames.forEach(pack => {
    const label = document.createElement("label");
    label.className = "pack-checkbox";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = pack;
    checkbox.id = `pack-${pack}`;
    checkbox.checked = true; // Default to all packs selected
    
    const packLabel = document.createElement("span");
    packLabel.textContent = pack.charAt(0).toUpperCase() + pack.slice(1);
    
    label.appendChild(checkbox);
    label.appendChild(packLabel);
    packOptions.appendChild(label);
  });
}

// Confirm pack selection and return to index.html
function confirmPacks() {
  const checkboxes = document.querySelectorAll("#packOptions input[type='checkbox']");
  const selectedPacks = [];
  
  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      selectedPacks.push(checkbox.value);
    }
  });
  
  if (selectedPacks.length === 0) {
    alert("Please select at least one pack!");
    return;
  }
  
  // Store selected packs in localStorage
  localStorage.setItem("selectedPacks", JSON.stringify(selectedPacks));
  
  // Redirect back to index.html
  window.location.href = "index.html";
}

// Go back without saving
function goBack() {
  // Save currently selected packs and go back to play setup
  const checkboxes = document.querySelectorAll("#packOptions input[type='checkbox']");
  const selectedPacks = [];
  checkboxes.forEach(checkbox => { if (checkbox.checked) selectedPacks.push(checkbox.value); });
  if (selectedPacks.length === 0) {
    alert('Please select at least one pack!');
    return;
  }
  localStorage.setItem('selectedPacks', JSON.stringify(selectedPacks));
  window.location.href = "play.html";
}

// Event listeners
document.getElementById("confirmPacksBtn").addEventListener("click", confirmPacks);
document.getElementById("backBtn").addEventListener("click", goBack);

// Initialize on load
document.addEventListener("DOMContentLoaded", initPackSelection);
