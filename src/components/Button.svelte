<script>
  
    import { onMount } from 'svelte';

// Variable pour suivre l'état du mode nuit
let darkMode = false;

// Fonction pour activer le mode nuit
function activerDarkMode() {
    darkMode = true;
    document.body.classList.add('darkMode'); // Ajouter la classe pour le mode nuit au body
    localStorage.setItem('darkMode', 'true'); // Stocker l'état dans localStorage
}

// Fonction pour désactiver le mode nuit
function desactiverDarkMode() {
    darkMode = false;
    document.body.classList.remove('darkMode'); // Supprimer la classe pour le mode nuit du body
    localStorage.setItem('darkMode', 'false'); // Stocker l'état dans localStorage
}

// Fonction pour basculer entre les modes
function toggleDarkMode() {
    if (darkMode) {
        desactiverDarkMode();
    } else {
        activerDarkMode();
    }
}

// Vérification de l'état du mode nuit au chargement de la page
onMount(() => {
    const darkModeValue = localStorage.getItem('darkMode');
    if (darkModeValue === 'true') {
        activerDarkMode();
    } else {
        desactiverDarkMode();
    }
});

</script>

<button class="buttonDarkMode"  tabindex="0" on:click={toggleDarkMode}>
    {#if darkMode}
        <!-- Afficher l'image pour le mode nuit -->
        <img class="sunDarkMod" src="src/assets/sunDarkMode.svg" alt="lune" />
    {:else}
        <!-- Afficher l'image pour le mode jour -->
        <img class="moodDarkMod" src="src/assets/moodDarkMode.svg" alt="soleil"/>
    {/if}
</button>
