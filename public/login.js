const statusMessage = document.getElementById("statusMessage");
const params = new URLSearchParams(window.location.search);

const messages = [
  ["verify_sent", "Poslat je mejl za potvrdu naloga."],
  ["sent", "Link je poslat. Proveri mejl."],
  ["weak_password", "Lozinka mora imati najmanje 8 karaktera."],
  ["mismatch", "Lozinke se ne poklapaju."],
  ["exists", "Nalog vec postoji. Idi na prijavu."],
  ["sender_not_verified", "Mail servis je u test modu. Podesi verifikovan sender domen za slanje korisnicima."],
  ["register_error", "Registracija nije uspela. Pokusaj ponovo."],
  ["error", "Neispravan mejl ili link."],
];

for (const [key, message] of messages) {
  if (params.get(key)) {
    statusMessage.textContent = message;
    statusMessage.classList.remove("hidden");
    break;
  }
}
