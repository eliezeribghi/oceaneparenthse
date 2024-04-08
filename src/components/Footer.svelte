<script>
  import { link } from "svelte-spa-router";
</script>

<section class="footer-section" aria-label="Footer">
  <div class="footer" role="contentinfo">
    <div class="footer-content">
      <!-- Section "Plan du site" -->
      <div class="footer-section site-links">
        <h3 class="footer-title">Plan du site</h3>
        <div class="footer-links">
          <!-- Liens vers différentes sections du site avec Svelte Router -->

          <a href="/" use:link aria-label="Accueil" tabindex="0">Accueil</a>

          <a href="/etale" use:link aria-label="Étale" tabindex="0">Étale</a>

          <a href="/haute" use:link aria-label="Haute" tabindex="0">Haute</a>

          <a href="/basse" use:link aria-label="Basse" tabindex="0">Basse</a>

          <a href="/contact" use:link aria-label="Contact" tabindex="0"
            >Contact</a
          >

          <a href="/info" use:link aria-label="Info" tabindex="0">Info</a>

          <a
            href="/infStVincentsurJardo"
            use:link
            aria-label="StVincentsurJard"
            tabindex="0"
          >
            StVincentsurJard</a
          >
          <a
            href="/privacyPolicy"
            use:link
            aria-label="Charte de Confidentialité"
            tabindex="0"
          >
            Charte de Confidentialité</a
          >
          <a
          href="/Agreement"
          use:link
          aria-label="Conditions Générales de Vente"
          tabindex="0"
        >
        Conditions Générales de Vente</a
        >
        </div>
      </div>

      <!-- Section "Suivez-nous" -->
      <div class="footer-section follow-us">
        <h3 class="footer-title">Suivez-nous</h3>
        <div class="footer-social">
          <!-- Lien Facebook avec l'icône -->
          <a
            href="https://www.facebook.com/profile.php?id=100077286376919"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
          >
            <img
              class="logo-meta"
              src="src/assets/logo-meta.svg"
              alt="logo-meta"
              aria-hidden="true"
            />
          </a>
          <!-- Ajoutez d'autres liens sociaux au besoin -->
        </div>
      </div>
      <!-- Section "À propos" -->
      <div class="footer-section about">
        <h2 class="footer-title">À propos</h2>
        <address>
          <p>Parenthèse Océane</p>
          <p>32 Rte de Saint-Hilaire, <br />85520 Saint-Vincent-sur-Jard</p>
        </address>
        <p>
          Téléphone : <a
            href="tel:+33123456789"
            aria-label="Numéro de téléphone">+33 1 23 45 67 89</a
          >
        </p>
        <a
          class="footer-mail"
          href="mailto:parentheseoceane@orange.fr"
          aria-label="Adresse e-mail">parentheseoceane@orange.fr</a
        >
      </div>
    </div>

    <div class="footer-bottom">
      <p>&copy; 2024 Parenthèse Océane. Tous droits réservés.</p>
    </div>
  </div>
</section>
