import '../../examples/kestrel-survey/src/style.css';
import { mountSurvey } from '../../examples/kestrel-survey/src/main.tsx';
if (new URLSearchParams(location.search).get('embed') === '1') document.body.classList.add('embedded');
await mountSurvey();
