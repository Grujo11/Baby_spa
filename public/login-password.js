const statusMessage = document.getElementById("statusMessage");
const params = new URLSearchParams(window.location.search);

const messages = [
  ["exists", "Nalog vec postoji. Prijavi se lozinkom."],
  ["password_ready", "Lozinka je postavljena. Sada se prijavi."],
  ["not_verified", "Prvo potvrdi mejl adresu."],
  ["no_password", "Nalog nema lozinku. Vrati se na registraciju i postavi lozinku."],
  ["login_error", "Neispravan mejl ili lozinka."],
  ["sender_not_verified", "Mail servis je u test modu. Podesi verifikovan sender domen za slanje korisnicima."],
  ["sent", "Poslat je magic link na mejl."],
  ["error", "Neispravan mejl ili link."],
];

for (const [key, message] of messages) {
  if (params.get(key)) {
    statusMessage.textContent = message;
    statusMessage.classList.remove("hidden");
    break;
  }
}
