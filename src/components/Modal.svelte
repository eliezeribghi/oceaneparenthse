<script>
  import '../style/utils/_mixins.scss';

  let showModal = true;
  let emailLink = "parentheseoceane@orange.fr";
  let phoneNumber = "+33 06 37 66 38 66";
  let facebookLink = "https://www.facebook.com/profile.php?id=100077286376919";

  function closeModal() {
    showModal = false;
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      closeModal();
    }
  }
</script>

<section>
  {#if showModal}
    <div class="modal-overlay">
      <div class="modal">
        <button class="close-button-modal" on:click={closeModal} on:keydown={handleKeyDown} tabindex="0" aria-label="Fermer la fenêtre modale">
          &times;
        </button>
        <div class="modal-content">
          <p>
            <a class="contact-link" href={emailLink} target="_blank" aria-label="Envoyer un email à Parenthèse Océane">EMAIL &nbsp; |</a>
            <a class="contact-link" href={"tel:" + phoneNumber} aria-label="Appeler Parenthèse Océane">{phoneNumber}</a>
            <a class="contact-link" href={facebookLink} target="_blank" aria-label="Visiter la page Facebook de Parenthèse Océane">| &nbsp; FACEBOOK</a>
          </p>
        </div>
      </div>
    </div>
  {/if}
</section>
