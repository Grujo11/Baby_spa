const statusMessage = document.getElementById("statusMessage");
const params = new URLSearchParams(window.location.search);

const messages = [
  ["verify_sent", "Poslat je mejl za potvrdu naloga."],
  ["sent", "Link je poslat. Proveri mejl."],
  ["exists", "Nalog vec postoji. Prijavi se lozinkom."],
  ["password_ready", "Lozinka je postavljena. Sada se prijavi."],
  ["weak_password", "Lozinka mora imati najmanje 8 karaktera."],
  ["mismatch", "Lozinke se ne poklapaju."],
  ["not_verified", "Prvo potvrdi mejl adresu."],
  ["no_password", "Ovaj nalog nema lozinku. Zatrazi magic link i prijavi se."],
  ["login_error", "Neispravan mejl ili lozinka."],
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
