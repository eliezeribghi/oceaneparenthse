import Home from "./pages/Home.svelte";
import NotFound from "./pages/NotFound.svelte";
import Haute from './pages/Haute.svelte';
import Info from "./pages/Info.svelte";
import Etale from "./pages/Etale.svelte";
import Basse from "./pages/Basse.svelte";
import Contact from './pages/Contact.svelte';
import StVincentsurJard from "./pages/StVincentsurJard.svelte";
import Agreement from "./pages/Agreement.svelte";
import PrivacyPolicy from "./pages/PrivacyPolicy.svelte";
export default {
    "/": Home,
    "/haute": Haute,
    "/etale": Etale,
    "/basse": Basse,
    "/contact": Contact,
    "/info": Info,
    "/stVincentsurJard/": StVincentsurJard,
    "/agreement": Agreement,
    "/privacyPolicy": PrivacyPolicy,
    "*": NotFound,

};