const statusMessage = document.getElementById("statusMessage");
const params = new URLSearchParams(window.location.search);

if (params.get("sent")) {
  statusMessage.textContent = "Link je poslat. Proveri mejl.";
  statusMessage.classList.remove("hidden");
}

if (params.get("error")) {
  statusMessage.textContent = "Neispravan mejl ili link.";
  statusMessage.classList.remove("hidden");
}
