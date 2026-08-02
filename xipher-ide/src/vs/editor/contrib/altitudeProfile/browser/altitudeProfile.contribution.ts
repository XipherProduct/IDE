import './altitudeProfile.css';
import { registerEditorContribution, EditorContributionInstantiation } from '../../../browser/editorExtensions.js';
import { AlaskaAltitudeProfile } from './altitudeProfile.js';

registerEditorContribution(AlaskaAltitudeProfile.ID, AlaskaAltitudeProfile, EditorContributionInstantiation.AfterFirstRender);
