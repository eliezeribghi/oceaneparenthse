<script>
    // Importation des fonctions nécessaires depuis la bibliothèque Svelte
    import { onMount, onDestroy } from "svelte";
    // Importation du tableau d'images depuis le fichier image.js
    export let images;

    // Initialisation de l'index de l'image actuelle
    let currentIndex = 0;
    // Initialisation des URL des deux images actuelles et suivantes
    let imageUrl1 = images[currentIndex].src;
    let imageUrl2 = images[(currentIndex + 1) % images.length].src;
    // Variable pour contrôler l'affichage des boutons

    let showButtons = false;

    // Interval pour changer d'image automatiquement toutes les 10 secondes
    const interval = setInterval(() => {
        currentIndex = (currentIndex + 1) % images.length;
        imageUrl1 = images[currentIndex].src;
        imageUrl2 = images[(currentIndex + 1) % images.length].src;
    }, 3000);

    // Fonction exécutée après le rendu initial du composant
    onMount(() => {
        // Nettoie l'intervalle lorsque le composant est démonté
        return () => clearInterval(interval);
    });

    // Fonction exécutée lorsqu'un composant est démonté
    onDestroy(() => {
        clearInterval(interval);
    });

    // Fonction pour basculer l'affichage des boutons
    function toggleButtons(value) {
        showButtons = value;
    }

    // Fonction pour passer à l'image suivante
    function nextImage() {
        currentIndex = (currentIndex + 1) % images.length;
        imageUrl1 = images[currentIndex].src;
        imageUrl2 = images[(currentIndex + 1) % images.length].src;
        // Récupération du title associé à l'image actuelle
        title = images[currentIndex].title;
    }

    // Fonction pour revenir à l'image précédente
    function prevImage() {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        imageUrl1 = images[currentIndex].src;
        imageUrl2 = images[(currentIndex + 1) % images.length].src;
        // Récupération du title associé à l'image actuelle
        title = images[currentIndex].title;
    }
    let title = images[currentIndex].title;
</script>

<!-- Partie HTML du composant -->

<section class="miniCarousel">
    <div
        class="carousel"
        role="button"
        aria-label="Carousel"
        aria-roledescription="Carousel avec deux images"
        aria-pressed="false"
        tabindex="0"
        on:mouseenter={() => toggleButtons(true)}
        on:mouseleave={() => toggleButtons(false)}
        on:keydown={(event) => handleKeyDown(event)}
    >
    <div class="image-container" tabindex="0" on:keydown={(e) => handleKeyDown(e)}>
            {#if showButtons}
                <button
                    class="prev-button"
                    on:click={() => prevImage()}
                    on:keydown={(event) => handleButtonKeyDown(event)}
                    aria-label="Image Précédente"
                >
                    &lt;
                </button>
            {/if}
            <img
                class="imageMiniCarousel"
                src={imageUrl1}
                alt="Première Image"
                role="img"
                aria-label="Première Image"
                aria-describedby="image-description"
                {title}
            />
            {#if showButtons}
                <button
                    class="next-button"
                    on:click={() => nextImage()}
                    on:keydown={(event) => handleButtonKeyDown(event)}
                    aria-label="Image Suivante"
                >
                    &gt;
                </button>
            {/if}
        </div>
    </div>
</section>
