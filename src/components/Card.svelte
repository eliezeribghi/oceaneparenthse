<script>
   
    import  rentals from "../dataImport/cards";
    function redirectToLink(link) {
    window.location.href = link;
  }

</script>

<section class="section3">
    <h1 class="title">Au Cœur de la Nature <br /> Nos Gîtes à Louer</h1>
  
    <div class="gites-rental">
        {#each rentals as { name, location, details, imageUrl, link, title }}
            <div class="imageGites">
                <img class="rental-image" src={imageUrl} alt={title + " image"} />

                <div class="rental-card">
                    <h2 class="textCardH2">{name}</h2>

                    <p class="textCard">{location}</p>
                    <p class="textCard">{details}</p>
                    <a class="textCard linkCard" href={link} on:click|preventDefault={() => redirectToLink(link)}>En savoir plus sur {name}</a>

                </div>
            </div>
        {/each}
    </div>

</section>



