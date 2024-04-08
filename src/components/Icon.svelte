<script>
    export let myAccommodation;

    let accommodationData = myAccommodation && myAccommodation.length > 0 ? myAccommodation[0] : null;
    
    const { svgPaths } = accommodationData;

    const iconTextMap = {
        1: { property: "capacity", suffix: "Hôtes" },
        2: { property: "rooms", suffix: "Chambre" },
        3: { property: "bathrooms", suffix: "Douche" },
        4: { property: "beds", suffix: "Lits" },
        5: { property: "squareMeter", suffix: "m²" },
    };
</script>

<section class="sectionIcon"  aria-label="Icônes de logement">
    <div class="icon-section" role="region">
        {#each svgPaths as { id, path, title, text }}
            <div class="icon-wrapper">
                <img class="icons" src={path} alt={title || "Icon"} aria-hidden="true" />
                <div class="textIcon">
                    <span class="numberIcon" aria-label="{accommodationData ? accommodationData[iconTextMap[id].property] ?? '' : ''} {iconTextMap[id].suffix} {text}">
                        {accommodationData ? accommodationData[iconTextMap[id].property] ?? "" : ""}{iconTextMap[id].suffix}
                     
                    </span>
                </div>
            </div>
        {/each}
    </div>
</section>
