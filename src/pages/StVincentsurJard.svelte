<script>

import { places } from "../dataImport/dataLieu/lieu.js";

let showModal = false;
let modalContent = {
  id: "",
  title: "",
  description: "",
  interest: "",
  practicalInfo: "",
  url: "",
  src: "",
  alt: "",
  name: "",
};

function fetchData() {
  fetch('../dataImport/dataLieu/lieu.json') // Remplacez le chemin par le chemin réel de votre fichier lieu.json
    .then(response => {
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données');
      }
      return response.json();
    })
    .then(data => {
      // Traitez les données récupérées
      console.log('Données des lieux récupérées :', data);
      // Mettez à jour votre variable places avec les données récupérées en utilisant setPlaces
      setPlaces(data);
      // Vous n'avez plus besoin de réaffecter places ici
      // Stockez les données en cache
      cacheData();
    })
    .catch(error => {
      console.error('Erreur :', error);
    });
}


// Appel de fetchData lorsque la page est chargée
window.addEventListener('load', () => {
  fetchData();
});



let showAdditionalContent = false;

function toggleText() {
  showAdditionalContent = !showAdditionalContent;
}

function handleScroll() {
  const scrollPosition = window.scrollY;
  const windowHeight = window.innerHeight;
  const elements = document.querySelectorAll(".scroll-animation");

  elements.forEach((element) => {
    const elementPosition = element.offsetTop;
    const elementHeight = element.offsetHeight;
    const startToShow = elementPosition - windowHeight + 10;

    if (scrollPosition > startToShow) {
      element.classList.add("show");
    } else {
      element.classList.remove("show");
    }
  });
}

function handleScrollAppear() {
  const boutonScroll = document.getElementById('boutonScroll');
  if (boutonScroll) {
    boutonScroll.style.display = (window.scrollY === 0) ? 'block' : 'none';
  }
}


function scrollToFirstSection() {
  const section = document.querySelector('.sectionTexteLieu');
  const boutonScroll = document.getElementById('boutonScroll');
  if (section) {
    window.scrollTo({
      top: section.offsetTop,
      behavior: 'smooth'
    });
    boutonScroll.style.display = 'none';
  }
}

const openModal = (content) => {
  modalContent = { ...content }; // Utilisation de la déstructuration pour éviter les mutations directes
  showModal = true;
};

const closeModal = () => {
  showModal = false;
};

let dialogDetails = {};
let dialogVisible = false;

const confirmRedirect = (url, name) => {
  dialogDetails = { url, name }; // Utilisation de la déstructuration pour éviter les mutations directes
  dialogVisible = true;
};

const proceedToSite = () => {
  window.open(dialogDetails.url, "_blank");
  dialogVisible = false;
};

const cancelRedirect = () => {
  dialogVisible = false;
};

let ticking = false;

window.addEventListener("scroll", () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      handleScroll();
      handleScrollAppear();
      ticking = false;
    });
    ticking = true;
  }
});

// Ajoutez d'autres fonctionnalités comme la gestion du scroll ici




</script>

<!-- description -->

<section aria-labelledby="pageTitle" class="descriptionHeader">
  <div>
    <h1><strong class="titreDescription">Saint-Vincent-sur-Jard</strong></h1>
  </div>

  <article class="main-content">
    <p>
      Niché sur les côtes venteuses de l'Atlantique, Saint-Vincent-sur-Jard est
      un petit bijou de la Vendée, offrant un mélange envoûtant de charme
      historique, de paysages naturels préservés et de détente balnéaire.
    </p>
    <!-- Bouton pour afficher/masquer le texte supplémentaire -->
    {#if !showAdditionalContent}
      <button class="readMore" on:click={toggleText}>Afficher plus</button>
    {/if}
    <!-- Contenu supplémentaire masqué par défaut -->
    {#if showAdditionalContent}
      <p>
        Ce village côtier, baigné de la lumière douce du soleil, séduit les
        visiteurs par son atmosphère paisible et son riche patrimoine. Du
        célèbre jardin de Georges Clémenceau aux sentiers sauvages de randonnée,
        chaque coin de Saint-Vincent-sur-Jard révèle une facette unique de son
        histoire et de sa beauté naturelle.
        
      </p>
      <!-- Bouton pour masquer le texte supplémentaire -->
      <button class="readMore" on:click={toggleText}>&times;</button>
    {/if}
      
  </article>
  <article class="main-content-desktop">
    <p>
      Niché sur les côtes venteuses de l'Atlantique, Saint-Vincent-sur-Jard est
      un petit bijou de la Vendée, offrant un mélange envoûtant de charme
      historique, de paysages naturels préservés et de détente balnéaire.
   
        Ce village côtier, baigné de la lumière douce du soleil, séduit les
        visiteurs par son atmosphère paisible et son riche patrimoine. Du
        célèbre jardin de Georges Clémenceau aux sentiers sauvages de randonnée,
        chaque coin de Saint-Vincent-sur-Jard révèle une facette unique de son
        histoire et de sa beauté naturelle.
        
      </p>
      <img class="logoVendee" src="src/assets/logo-vendee.png" alt="Logo de la Vendée">

  </article>


</section>

<!-- Bouton de défilement vers la première section -->
<button id="boutonScroll" on:click={scrollToFirstSection} >
  <span></span>
</button>

<!-- Lieux -->

<section class="sectionTexteLieu"></section>
<!-- Lieux -->
<section class="sectionTexteLieu">
  {#each places as place (place.id)}
    <div class="tourist-site scroll-animation" aria-label={place.title} role="region">
      <div class="site-image">
        <img loading="lazy" src={place.src} alt={place.alt} title={place.name} />
      </div>
      <div class="site-description">
        <h2>{place.title}</h2>
        <p>{place.description.substring(0, 100)}...</p>
        <!-- Ajout de la gestion des événements clavier pour l'accessibilité -->
        <a
          class="linkPlace"
          href="javascript:void(0)"
          on:click|stopPropagation={() => openModal(place)}
          on:keydown={(event) => {
            if (event.key === 'Enter') {
              openModal(place);
            }
          }}
          tabindex="0"
          aria-label="En savoir plus sur {place.title}" 
          role="button" 
        >
          En savoir plus
        </a>
      </div>
    </div>
  {/each}
</section>


<!-- Modal -->
<section>
  {#if showModal}
  <div class="modalLieu" role="dialog" aria-modal="true">
    <div class="modalContent">
      <span class="close-button" role="button" tabindex="0" on:click={closeModal} on:keydown={(event) => { if (event.key === 'Enter' || event.key === 'Escape') { closeModal(); } }}>&times;</span>
      <h2>{modalContent.title}</h2>
      <img 
        loading="lazy"
        src={modalContent.src}
        alt={modalContent.alt}
        title={modalContent.name}
      />
  
      <h3>Description</h3>
      <p>{modalContent.description}</p>
      <h3>Intérêt touristique</h3>
      <p>{modalContent.interest}</p>
      <h3>Informations pratiques</h3>
      <p>{modalContent.practicalInfo}</p>
      <h3>Lien vers site</h3>
      <a
        href={modalContent.url}
        on:click|preventDefault={() => confirmRedirect(modalContent.url, modalContent.name)}
      >
        Cliquez ici pour en savoir plus
      </a>
    </div>
  </div>
  {/if}
  
  
</section>
<!-- Boîte de dialogue personnalisée -->
{#if dialogVisible}
  <div class="customDialog">
    <p>
      Vous allez être redirigé vers un autre site. Voulez-vous
      continuer ?
    </p>
    <div class="buttonContainer">
    <button class="confirmButton" on:click={proceedToSite}>Oui</button>
    <button class="cancelButton" on:click={cancelRedirect}>Non</button>
    </div>
  </div>
{/if}




