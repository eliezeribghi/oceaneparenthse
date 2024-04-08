<script>
  // @ts-nocheck

  import Card from "../components/Card.svelte";

  import Slider from "../components/Slider.svelte";



  import { onMount } from "svelte";

  onMount(() => {
    const script = document.createElement("script");
    script.src = "https://static.elfsight.com/platform/platform.js";
    script.dataset.useServiceCore = true;
    script.defer = true;

    document.body.appendChild(script);
  });
</script>

<section>
  <Slider />
</section>

<section class="cards">

  <Card />
</section>

<section class="review">
  <div class="review">
    <h2 class="titleReview">Avis Clients</h2>
    <img
      class="guillemets"
      src="src/assets/public/guillemets-haut.svg"
      alt=""
      srcset=""
    />
    <div
      class="elfsight-app-b60d04a1-b839-40ae-8a36-9a1dc3d8d03a reviewConteneur"
      data-elfsight-app-lazy
    >
      <div class="under"></div>
    </div>
    <img class="guillemets" src="src/assets/public/guillemets-bas.svg" alt="" />
  </div>
</section>

