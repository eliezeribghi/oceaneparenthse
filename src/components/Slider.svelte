<script>
  import { onMount, afterUpdate } from "svelte";
  import images from "../dataImport/+server";
import '../style/components/slider.scss'
  let currentImageIndex = 0;
  let containerWidth = 0;

  // Fonction pour passer à l'image suivante
  function nextImage() {
    currentImageIndex = (currentImageIndex + 1) % images.length;
  }

  // Effectué après le montage du composant
  onMount(() => {
    calculateContainerWidth();

    // Déclenche le changement d'image toutes les 5 secondes
    const interval = setInterval(() => {
      nextImage();
      calculateContainerWidth();
    }, 5000);

    // Nettoie l'intervalle après la mise à jour du composant
    return () => clearInterval(interval);
  });

  // Effectué après chaque mise à jour du composant
  afterUpdate(() => {
    calculateContainerWidth();
  });

  // Fonction pour calculer la largeur du conteneur en fonction du nombre d'images
  function calculateContainerWidth() {
    containerWidth = images.length * window.innerWidth;
  }
</script>

<section class="carousel-container"  aria-label="Carousel" >
   
  <div class="text-container top-text">
    
    <!-- En-tête du carousel -->
    <h1  id="carousel-heading" aria-label="Bienvenue à Saint Vincent sur Jard, Carousel" preload>
      BIENVENUE <br /> A <br /> SAINT VINCENT SUR JARD
    </h1>
 
    <!-- Conteneur du logo -->
    <div class="logo-container">
      <img class="logo-slide" src="src/assets/logo.png" alt="Logo" loading="lazy" />
    </div>
     <!-- Conteneur du logo-region -->
     <div class='logo-region'>
      <img class="logo-vendee" src="src/assets/logo-vendee.png" alt="Logo" loading="lazy" />
    </div>
  </div>
  
  <!-- Wrapper du carousel -->
  <div
    class="carousel-wrapper"
    role="group"
    aria-roledescription="image slider"
    tabindex="-1"
  >
    <!-- Conteneur du carousel d'images -->
    <div
      class="image-carousel"
      style={`transform: translateX(${
        -currentImageIndex * window.innerWidth
      }px); width: ${containerWidth}px`}
      role="listbox"
    >
    
      {#each images as { src, alt }, index}
  
        <img
        class="carousel-image"
          src={src}
          srcset={`${src} 600w, ${src} 1200w, ${src} 2000w`}
          sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 25vw"
          alt={`Image ${index + 1}: ${alt}`}
          role="presentation"
          aria-hidden={index !== currentImageIndex}
          aria-labelledby="carousel-heading"
          tabindex="-1"
        />
        
      {/each}
    </div>
  </div>
</section>

