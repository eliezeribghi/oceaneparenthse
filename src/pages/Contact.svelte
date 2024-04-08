<script>
   import { link } from "svelte-spa-router";
  let formData = {
access_key: "ffeeaec2-8c68-4a9f-9ce0-87f18312330e",
  // access_key: "a506e8c2-dd45-454f-a638-9b19e73f0ede",
  name: "",
  lastname: "",
  email: "",
  phoneNumber: "",
  subject: "",
  message: "",
  consent: false, 
  errorMessage: "",
  successMessage: "",
  redirect: "https://web3forms.com/success"
};


  // Validation de l'e-mail
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }


// Validation du numéro de téléphone
function isValidPhoneNumber(phoneNumber) {
  // Utilisation d'une expression régulière pour valider le numéro de téléphone
  const phoneRegex = /^\+?\d{0,3}?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
  return phoneRegex.test(phoneNumber);
}
const handleSubmit = async () => {
  if (!isValidEmail(formData.email)) {
    formData.errorMessage = "Veuillez entrer une adresse e-mail valide.";
    return;
  }

  if (!isValidPhoneNumber(formData.phoneNumber)) {
    formData.errorMessage = "Veuillez entrer un numéro de téléphone valide.";
    return;
  }

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      formData.successMessage = "Votre formulaire a été soumis avec succès!";
      // Réinitialiser les valeurs du formulaire après soumission réussie
      formData.name = "";
      formData.lastname = "";
      formData.email = "";
      formData.phoneNumber = "";
      formData.subject = "";
      formData.message = "";
      formData.consent = false;
      // Redirection après une soumission réussie
      window.location.href = formData.redirect;
    } else {
      formData.errorMessage = "Une erreur s'est produite lors de la soumission du formulaire. Veuillez réessayer plus tard.";
    }
  } catch (error) {
    console.error("Error submitting form:", error);
    formData.errorMessage = "Une erreur s'est produite lors de la soumission du formulaire. Veuillez réessayer plus tard.";
  }
};

</script>

<section class="from-section">
  <div class="header-contact">
    <div class="section-logo">
      <img class="logo-header" src="src/assets/logo.png" alt="" />
    </div>
    <h1 class="title-header">Contactez-nous</h1>
    <p class="text-header">
      Merci de bien vouloir remplir le formulaire ci-dessous pour nous contacter,
      que ce soit pour des demandes de location ou des demandes d'informations.
    </p>
  </div>

  <!-- Affichage des erreurs -->
  {#if formData.errorMessage}
    <div class="error-message">{formData.errorMessage}</div>
  {/if}

  <!-- Affichage du message de succès -->
  {#if formData.successMessage}
    <div class="success-message">{formData.successMessage}</div>
  {/if}

  <form class="contact-form" on:submit|preventDefault={handleSubmit}>
    <div class="selectName">
      <div class="form-group">
        <label for="nom" class="form-label">*Nom <span class="requis">(requis)</span></label>  
        <input
          type="text"
          id="nom"
          class="form-name"
          placeholder="Nom"
          bind:value={formData.name}
          required
        />
      </div>

      <div class="form-group">
        <label for="prenom" class="form-label">*Prénom :</label>
        <input
          type="text"
          id="prenom"
          class="form-lastname"
          placeholder="Prénom"
          bind:value={formData.lastname}
        />
      </div>
    </div>

    <div class="form-group">
      <label for="email" class="form-label">*E-mail <span class="requis">(requis)</span></label>  
      <input
        type="email"
        id="email"
        class="common-input form-input"
        placeholder="Entrez votre e-mail"
        bind:value={formData.email}
        required
      />
    </div>

    <div class="form-group">
      <label for="telephone" class="form-label">*Numéro de téléphone <span class="requis">(requis)</span></label>  
      <input
        type="tel"
        id="telephone"
        class="common-input form-input"
        name="telephone"
        placeholder="Entrez votre numéro"
        bind:value={formData.phoneNumber}
        required
      />
    </div>

    <div class="form-group">
      <label for="subject" class="form-label">*Sujet <span class="requis">(requis)</span></label>
      <input
          id="subject"
          class="common-input subjectSection"
          bind:value={formData.subject}
          required
          aria-describedby="subjectError"
          on:input={() => formData.errorMessage = ""}
      />
      {#if formData.errorMessage && !formData.subject}
          <p id="subjectError" class="error-message">{formData.errorMessage}</p>
      {/if}
  </div>
  
  <div class="form-group">
      <label for="message" class="form-label">*Message <span class="requis">(requis)</span></label>
      <textarea
          id="message"
          class="common-input"
          bind:value={formData.message}
          rows="4"
          required
          aria-describedby="messageError"
          on:input={() => formData.errorMessage = ""}
      ></textarea>
      {#if formData.errorMessage && !formData.message}
          <p id="messageError" class="error-message">{formData.errorMessage}</p>
      {/if}
  </div>
  
<!-- Ajoutez ces éléments à la fin de votre section "from-section" -->

<div class="consent-checkbox">
  <input type="checkbox" id="consent" bind:checked={formData.consent} required>
  <label for="consent"><span class="requis">(requis)</span> <br>**Je consens au traitement de mes données personnelles. </label>
</div>


    <button type="submit" class="submit-button">Envoyer</button>
  </form>

  <section class="consent-text">

    <p>* Champs obligatoires. Ces informations restent confidentielles et ne seront jamais partagées avec aucun tiers.

      <br> ** En soumettant ce formulaire, j'accepte que les informations saisies soient utilisées et traitées pour me recontacter, en réponse à ma demande d'informations, que ce soit par e-mail ou téléphone.  <a
            href="/privacyPolicy"
            use:link
            aria-label="Charte de Confidentialité"
            tabindex="0"
          >
            Charte de Confidentialité</a
          > </p>
  
  </section>
</section>

