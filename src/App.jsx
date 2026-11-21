import { Fragment, useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'
import {
  activateProcessId,
  createProcessId,
  isValidProcessId,
  loadCurrentProcessId,
  removeCurrentProcessId,
  saveCurrentProcessId,
} from './processIdentity'
import { buildProcessSnapshot } from './processSnapshot'
import { completedProcessExportStem } from './processExportName'
import { compareProcessSteps, withDetectedStepChanges } from './processStepComparison'
import { getRaciValidationErrors } from './raci'
import { upsertSavedProcess } from './savedProcesses'
import { deleteSavedProcess } from './deleteSavedProcess'
import { DEFAULT_WORK_MODE, normalizeWorkMode } from './workMode'
import { supabase } from './supabaseClient'
import WorkshopPanel from './WorkshopPanel'
import { appendWorkshopSteps, getWorkshopStorageKeys, loadWorkshop, loadWorkshopReview } from './workshop'
import ProcessConnections from './ProcessConnections.jsx'
import BpmnExport from './BpmnExport.jsx'
import BpmnDecisions from './BpmnDecisions'
import BpmnLanes from './BpmnLanes'
import BpmnMessages from './BpmnMessages.jsx'
import BpmnExternalMessages from './BpmnExternalMessages'
import BpmnExternalSteps from './BpmnExternalSteps'
import PrintBpmnDetails from './PrintBpmnDetails'
import { bpmnDocumentDirections, bpmnStepFields, bpmnTaskTypes, emptyBpmnStep, getBpmnDocuments, getBpmnStepError, readBpmnStepDraft } from './bpmnStepDetails'
import { getDecisionBpmnError } from './bpmnDecisionValidation'
import { copyAsIsBpmn, toBeBpmnScope } from './toBeBpmn'
import { findingCategories, getToBeStepSuggestion } from './toBeSuggestions'
import { addBpmnMessage, removeBpmnMessage } from './bpmnMessages.js'
import { addProcessConnection, getProcessConnections, removeProcessConnection, removeStepConnections, setProcessDecision, setProcessLane } from './processConnections.js'
const stages = ['Zakres', 'AS-IS', 'Analiza', 'TO-BE', 'Raport']
const STORAGE_KEY = 'architekt-procesow:scope'
const AS_IS_STORAGE_KEY = 'architekt-procesow:as-is'
const ANALYSIS_STORAGE_KEY = 'architekt-procesow:analysis'
const TO_BE_STORAGE_KEY = 'architekt-procesow:to-be'
const REPORT_STORAGE_KEY = 'architekt-procesow:report'
const PROCESSES_STORAGE_KEY = 'architekt-procesow:processes'
const SCREEN_STORAGE_KEY = 'architekt-procesow-screen-to-open'
const PROCESS_SCREENS = ['scope', 'as-is', 'analysis', 'to-be', 'report']
const PROCESS_SECTION_STORAGE_KEYS = [
  STORAGE_KEY,
  AS_IS_STORAGE_KEY,
  ANALYSIS_STORAGE_KEY,
  TO_BE_STORAGE_KEY,
  REPORT_STORAGE_KEY,
]

const impactLevels = ['Niski', 'Średni', 'Wysoki']
const stakeholderTypes = [
  'Właściciel procesu',
  'Rola realizująca',
  'Odbiorca rezultatu',
  'Zespół wspierający',
  'Osoba decyzyjna',
  'Inny',
]

const emptyScope = {
  processName: '',
  processGoal: '',
  processStart: '',
  processEnd: '',
  processOwner: '',
  participants: '',
  customer: '',
  outOfScope: '',
}

const requiredFields = {
  processName: 'Uzupełnij nazwę procesu.',
  processGoal: 'Opisz cel procesu.',
  processStart: 'Określ, co rozpoczyna proces.',
  processEnd: 'Określ, co kończy proces.',
}

const bpmnStepFieldMap = Object.fromEntries(Object.keys(emptyBpmnStep).map((key) => [key, key]))

const emptyStep = {
  ...emptyBpmnStep,
  name: '',
  description: '',
  owner: '',
  system: '',
  result: '',
}

const emptyFinding = {
  category: '',
  name: '',
  location: '',
  situation: '',
  cause: '',
  processImpact: '',
  impactLevel: 'Średni',
  improvement: '',
}

const emptyToBeAssumptions = {
  changeGoal: '',
  expectedResult: '',
  constraints: '',
  successMeasures: '',
}

const emptyToBeStep = {
  ...emptyBpmnStep,
  name: '',
  description: '',
  owner: '',
  system: '',
  result: '',
  stepType: 'Nowy',
  findingId: '',
  additionalFindingIds: [],
  automatable: 'Nie',
}

const emptyStakeholder = {
  name: '',
  type: 'Rola realizująca',
  influence: 'Średni',
  interest: 'Średnie',
  expectations: '',
  engagement: '',
}

function hasPendingForm(draft, defaults, editingId) {
  return Boolean(editingId) || Object.entries(defaults).some(([field, initial]) => {
    const value = draft[field] ?? initial
    return Array.isArray(initial) ? value.length > 0 : value !== initial
  })
}


function loadSavedScope() {
  try {
    const savedScope = JSON.parse(localStorage.getItem(STORAGE_KEY))

    if (!savedScope || typeof savedScope !== 'object') {
      return { data: emptyScope, startMethod: null, workMode: DEFAULT_WORK_MODE }
    }

    return {
      data: { ...emptyScope, ...savedScope.data },
      startMethod: savedScope.startMethod ?? null,
      workMode: normalizeWorkMode(savedScope.workMode),
    }
  } catch {
    return { data: emptyScope, startMethod: null, workMode: DEFAULT_WORK_MODE }
  }
}

function loadSavedAsIs() {
  try {
    const savedAsIs = JSON.parse(localStorage.getItem(AS_IS_STORAGE_KEY))

    if (!savedAsIs || typeof savedAsIs !== 'object') {
      return { description: '', steps: [], isSaved: false }
    }

    return {
      description: savedAsIs.description ?? '',
      steps: Array.isArray(savedAsIs.steps) ? savedAsIs.steps : [],
      externalSteps: Array.isArray(savedAsIs.externalSteps) ? savedAsIs.externalSteps : [],
      externalLinks: Array.isArray(savedAsIs.externalLinks) ? savedAsIs.externalLinks : [],
      isSaved: Boolean(savedAsIs.savedAt),
    }
  } catch {
    return { description: '', steps: [], isSaved: false }
  }
}

function loadSavedAnalysis() {
  try {
    const savedAnalysis = JSON.parse(localStorage.getItem(ANALYSIS_STORAGE_KEY))

    if (!savedAnalysis || typeof savedAnalysis !== 'object') {
      return { findings: [], isSaved: false }
    }

    return {
      findings: Array.isArray(savedAnalysis.findings)
        ? savedAnalysis.findings.map((finding) => ({
            ...emptyFinding,
            ...finding,
          }))
        : [],
      isSaved: Boolean(savedAnalysis.savedAt),
    }
  } catch {
    return { findings: [], isSaved: false }
  }
}

function loadSavedToBe() {
  try {
    const savedToBe = JSON.parse(localStorage.getItem(TO_BE_STORAGE_KEY))

    if (!savedToBe || typeof savedToBe !== 'object') {
      return {
        assumptions: emptyToBeAssumptions,
        selectedFindingIds: null,
        steps: [],
        copiedFromAsIs: false,
        isSaved: false,
      }
    }

    return {
      assumptions: { ...emptyToBeAssumptions, ...savedToBe.assumptions },
      selectedFindingIds: Array.isArray(savedToBe.selectedFindingIds)
        ? savedToBe.selectedFindingIds
        : null,
      steps: Array.isArray(savedToBe.steps)
        ? savedToBe.steps.map((step) => ({ ...emptyToBeStep, ...step }))
        : [],
      externalSteps: Array.isArray(savedToBe.externalSteps) ? savedToBe.externalSteps : [],
      externalLinks: Array.isArray(savedToBe.externalLinks) ? savedToBe.externalLinks : [],
      copiedFromAsIs: Boolean(savedToBe.copiedFromAsIs),
      isSaved: Boolean(savedToBe.savedAt),
    }
  } catch {
    return {
      assumptions: emptyToBeAssumptions,
      selectedFindingIds: null,
      steps: [],
      copiedFromAsIs: false,
      isSaved: false,
    }
  }
}

function loadSavedReport() {
  try {
    const savedReport = JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY))
    if (!savedReport || typeof savedReport !== 'object') {
      return { stakeholders: [], raci: {}, initialized: false, isSaved: false }
    }
    return {
      stakeholders: Array.isArray(savedReport.stakeholders)
        ? savedReport.stakeholders.map((item) => ({
            ...emptyStakeholder,
            ...item,
          }))
        : [],
      raci:
        savedReport.raci && typeof savedReport.raci === 'object'
          ? savedReport.raci
          : {},
      initialized: Boolean(savedReport.initialized),
      isSaved: Boolean(savedReport.savedAt),
    }
  } catch {
    return { stakeholders: [], raci: {}, initialized: false, isSaved: false }
  }
}

function buildSuggestedStakeholders(scope, asIsSteps, toBeSteps) {
  const candidates = [
    { name: scope.processOwner, type: 'Właściciel procesu' },
    ...asIsSteps.map((step) => ({ name: step.owner, type: 'Rola realizująca' })),
    ...toBeSteps.map((step) => ({ name: step.owner, type: 'Rola realizująca' })),
  ]
  const unique = new Map()

  candidates.forEach(({ name, type }) => {
    const cleanName = name?.trim()
    if (!cleanName) return
    const key = cleanName.toLocaleLowerCase('pl')
    if (!unique.has(key)) {
      unique.set(key, {
        ...emptyStakeholder,
        id: `suggested-${key.replace(/[^a-ząćęłńóśźż0-9]+/gi, '-')}`,
        name: cleanName,
        type,
      })
    }
  })

  return [...unique.values()]
}

function CompassIcon() {
  return (
    <span className="compass-icon" aria-hidden="true">
      <span />
    </span>
  )
}

function AppHeader({ onHome, onProcesses, onTestSupabase, supabaseTest }) {
  const testLabel =
    supabaseTest.status === 'loading'
      ? 'Supabase: sprawdzanie...'
      : supabaseTest.status === 'success'
        ? `Supabase: ${supabaseTest.count} rekordów`
        : supabaseTest.status === 'configuration-error'
          ? 'Supabase: brak konfiguracji'
          : supabaseTest.status === 'request-error'
            ? 'Supabase: błąd odczytu'
            : 'Test odczytu Supabase'

  return (
    <header className="topbar">
      <a
        className="brand"
        href="/"
        aria-label="Architekt Procesów — strona główna"
        onClick={(event) => {
          event.preventDefault()
          onHome()
        }}
      >
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="brand-copy">
          <strong>Architekt Procesów</strong>
          <span>Zaprojektuj, przeanalizuj i usprawnij swój proces krok po kroku</span>
        </span>
      </a>
     <div className="header-actions">
  {import.meta.env.MODE === 'workshop-local' ? (
    <span>Warsztat lokalny · zapis w tej przeglądarce</span>
  ) : (
    <button
      type="button"
      className="status-badge"
      onClick={onTestSupabase}
      disabled={supabaseTest.status === 'loading'}
      aria-live="polite"
    >
      {testLabel}
    </button>
  )}

  <button
    type="button"
    className="status-badge"
    onClick={onProcesses}
  >
    Moje procesy
  </button>

  <button
    type="button"
    className="status-badge"
    onClick={onHome}
  >
    <span aria-hidden="true">●</span>
    Nowy proces
  </button>
</div>
    </header>
  )
}

function ProcessProgress({ activeStage = 0 }) {
  return (
    <nav className="progress" aria-label="Etapy projektowania procesu">
      <ol>
        {stages.map((stage, index) => (
          <li
            className={[
              index === activeStage ? 'active' : '',
              index < activeStage ? 'completed' : '',
            ].filter(Boolean).join(' ')}
            key={stage}
            aria-current={index === activeStage ? 'step' : undefined}
          >
            <span className="stage-number">{index < activeStage ? '✓' : index + 1}</span>
            <span className="stage-label">{stage}</span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function StartScreen({ onStart, workMode, onWorkModeChange }) {
  return (
    <section className="workspace" aria-labelledby="page-title">
      <div className="intro">
        <span className="eyebrow">
          <CompassIcon />
          Etap 1 · Zakres procesu
        </span>
        <h1 id="page-title">Zacznij od tego, co wiesz o swoim procesie</h1>
        <p>
          Poprowadzimy Cię od określenia początku i końca procesu, przez analizę
          obecnego przebiegu, aż do propozycji usprawnionego procesu docelowego.
        </p>
      </div>

      <div className="mode-section">
        <div className="section-heading">
          <div>
            <span className="section-number">01</span>
            <h2>Wybierz tryb pracy</h2>
          </div>
          <p>Możesz zmienić go później</p>
        </div>

        <div className="mode-switch" role="group" aria-label="Tryb pracy">
          <button
  className={workMode === "guided" ? "mode-button selected" : "mode-button"}
  type="button"
  aria-pressed={workMode === "guided"}
  onClick={() => onWorkModeChange("guided")}
>
            <span className="mode-icon" aria-hidden="true">✦</span>
            <span>
              <strong>Tryb z przewodnikiem</strong>
              <small>Dla osób bez doświadczenia</small>
            </span>
            <span className="check" aria-hidden="true">
  {workMode === "guided" ? "✓" : ""}
</span>
          </button>
          <button
  className={workMode === "expert" ? "mode-button selected" : "mode-button"}
  type="button"
  aria-pressed={workMode === "expert"}
  onClick={() => onWorkModeChange("expert")}
>
            <span className="mode-icon expert" aria-hidden="true">⌁</span>
            <span>
              <strong>Tryb ekspercki</strong>
              <small>Dla osób znających analizę procesów</small>
            </span>
            <span className="check" aria-hidden="true">
  {workMode === "expert" ? "✓" : ""}
</span>
          </button>
        </div>
      </div>

      <div className="path-section">
        <div className="section-heading">
          <div>
            <span className="section-number">02</span>
            <h2>Jak chcesz zacząć?</h2>
          </div>
          <p>Wybierz sposób, który jest dla Ciebie wygodniejszy</p>
        </div>

        <div className="path-grid">
          <button
            className="path-card path-card-primary"
            type="button"
            onClick={() => onStart('describe')}
          >
            <span className="path-icon text-lines" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="path-content">
              <span className="recommended">Polecane na początek</span>
              <strong>Opisz cały proces</strong>
              <small>
                Opowiedz własnymi słowami, jak wygląda Twój proces. Pomożemy
                uporządkować informacje.
              </small>
            </span>
            <span className="arrow" aria-hidden="true">→</span>
          </button>

          <button
            className="path-card"
            type="button"
            onClick={() => onStart('steps')}
          >
            <span className="path-icon steps-icon" aria-hidden="true">
              <i>1</i>
              <i>2</i>
              <i>3</i>
            </span>
            <span className="path-content">
              <strong>Dodaj kroki samodzielnie</strong>
              <small>
                Twórz kolejne kroki procesu i porządkuj je we własnym tempie.
              </small>
            </span>
            <span className="arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  )
}

function FormField({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  helper,
  multiline = false,
  placeholder,
}) {
  const describedBy = [helper ? `${id}-helper` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ') || undefined

  const fieldProps = {
    id,
    name: id,
    value,
    onChange,
    placeholder,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
    className: error ? 'field-error' : undefined,
  }

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="required-mark"> *</span>}
      </label>
      {multiline ? <textarea {...fieldProps} rows="4" /> : <input {...fieldProps} />}
      {helper && <p className="field-helper" id={`${id}-helper`}>{helper}</p>}
      {error && (
        <p className="error-message" id={`${id}-error`} role="alert">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      )}
    </div>
  )
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  required = false,
  placeholder = 'Wybierz opcję',
}) {
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="required-mark"> *</span>}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        className={error ? 'field-error' : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value
          const optionLabel = typeof option === 'string' ? option : option.label
          return (
            <option value={optionValue} key={optionValue}>
              {optionLabel}
            </option>
          )
        })}
      </select>
      {error && (
        <p className="error-message" id={`${id}-error`} role="alert">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      )}
    </div>
  )
}

function ScopeForm({
  formData,
  errors,
  startMethod,
  saved,
  saveError,
  onBack,
  onChange,
  onSubmit,
}) {
  const startMethodLabel =
    startMethod === 'steps' ? 'Dodaj kroki samodzielnie' : 'Opisz cały proces'

  return (
    <section className="workspace scope-workspace" aria-labelledby="scope-title">
      <div className="scope-intro">
        <div>
          <span className="eyebrow">
            <CompassIcon />
            Etap 1 · Zakres procesu
          </span>
          <h1 id="scope-title">Określ granice swojego procesu</h1>
          <p>
            Zbierz najważniejsze informacje. Dzięki nim kolejne etapy analizy będą
            dotyczyć dokładnie tego procesu, który chcesz usprawnić.
          </p>
        </div>
        <span className="selected-path">
          <span aria-hidden="true">✓</span>
          Wybrany sposób: <strong>{startMethodLabel}</strong>
        </span>
      </div>

      <form className="scope-form" onSubmit={onSubmit} noValidate>
        <div className="form-section">
          <div className="form-section-title">
            <span>01</span>
            <div>
              <h2>Podstawowe informacje</h2>
              <p>Nazwij proces i opisz, jaki rezultat ma zapewniać.</p>
            </div>
          </div>
          <div className="form-grid">
            <FormField
              id="processName"
              label="Nazwa procesu"
              value={formData.processName}
              onChange={onChange}
              error={errors.processName}
              required
              placeholder="np. Obsługa zamówienia klienta"
            />
            <FormField
              id="processGoal"
              label="Cel procesu"
              value={formData.processGoal}
              onChange={onChange}
              error={errors.processGoal}
              required
              placeholder="Jaki rezultat ma zapewnić ten proces?"
            />
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">
            <span>02</span>
            <div>
              <h2>Początek i koniec procesu</h2>
              <p>Wyznacz zdarzenia, pomiędzy którymi analizujemy proces.</p>
            </div>
          </div>
          <div className="form-grid boundary-grid">
            <div className="boundary-card">
              <span className="boundary-label">Początek</span>
              <FormField
                id="processStart"
                label="Co rozpoczyna proces?"
                value={formData.processStart}
                onChange={onChange}
                error={errors.processStart}
                required
                helper="Zdarzenie, potrzeba lub informacja uruchamiająca proces"
                placeholder="np. Klient składa zamówienie"
                multiline
              />
              <p className="guidance">
                <strong>Jak o tym myśleć?</strong>
                Wskaż konkretny moment, bez którego proces nie zostałby uruchomiony.
              </p>
            </div>
            <div className="boundary-card">
              <span className="boundary-label">Koniec</span>
              <FormField
                id="processEnd"
                label="Co kończy proces?"
                value={formData.processEnd}
                onChange={onChange}
                error={errors.processEnd}
                required
                helper="Rezultat, decyzja lub przekazanie kończące proces"
                placeholder="np. Zamówienie zostaje dostarczone"
                multiline
              />
              <p className="guidance">
                <strong>Jak o tym myśleć?</strong>
                Opisz moment, w którym cel procesu jest osiągnięty lub odpowiedzialność
                zostaje przekazana dalej.
              </p>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">
            <span>03</span>
            <div>
              <h2>Osoby i granice odpowiedzialności</h2>
              <p>Te pola możesz uzupełnić teraz lub wrócić do nich później.</p>
            </div>
          </div>
          <div className="form-grid">
            <FormField
              id="processOwner"
              label="Właściciel procesu"
              value={formData.processOwner}
              onChange={onChange}
              placeholder="Osoba odpowiedzialna za wynik procesu"
            />
            <FormField
              id="participants"
              label="Główni uczestnicy lub role"
              value={formData.participants}
              onChange={onChange}
              placeholder="np. Sprzedaż, magazyn, księgowość"
            />
            <FormField
              id="customer"
              label="Klient albo odbiorca rezultatu procesu"
              value={formData.customer}
              onChange={onChange}
              placeholder="Kto otrzymuje rezultat procesu?"
            />
            <FormField
              id="outOfScope"
              label="Co znajduje się poza zakresem procesu?"
              value={formData.outOfScope}
              onChange={onChange}
              placeholder="Czego świadomie nie analizujemy?"
              multiline
            />
          </div>
        </div>

        {saved && (
          <div className="save-message success-message" role="status">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Zakres procesu został zapisany</strong>
              <small>Możesz nadal uzupełniać lub poprawiać dane.</small>
            </div>
          </div>
        )}

        {saveError && (
          <div className="save-message storage-error" role="alert">
            <span aria-hidden="true">!</span>
            <div>
              <strong>Nie udało się zapisać danych</strong>
              <small>Sprawdź ustawienia przeglądarki i spróbuj ponownie.</small>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="back-button" type="button" onClick={onBack}>
            <span aria-hidden="true">←</span>
            Wróć
          </button>
          <button className="save-button" type="submit">
            Zapisz zakres i przejdź dalej
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </section>
  )
}

function ScopeSummary({ scope }) {
  const items = [
    ['Nazwa procesu', scope.processName],
    ['Początek', scope.processStart],
    ['Koniec', scope.processEnd],
  ]

  return (
    <aside className="scope-summary" aria-label="Podsumowanie zakresu procesu">
      {items.map(([label, value], index) => (
        <div className="summary-item" key={label}>
          <span className="summary-icon" aria-hidden="true">
            {index === 0 ? 'P' : index === 1 ? '↗' : '✓'}
          </span>
          <span>
            <small>{label}</small>
            <strong>{value}</strong>
          </span>
        </div>
      ))}
    </aside>
  )
}

function DescribeAsIs({
  description,
  error,
  onChange,
}) {
  return (
    <div className="as-is-editor description-editor">
      <div className="form-section-title">
        <span>01</span>
        <div>
          <h2>Opisz obecny przebieg procesu</h2>
          <p>Nie porządkuj go na siłę — najważniejsze jest uchwycenie rzeczywistości.</p>
        </div>
      </div>
      <FormField
        id="asIsDescription"
        label="Opisz, jak proces przebiega obecnie"
        value={description}
        onChange={onChange}
        error={error}
        required
        multiline
        placeholder="Zacznij od pierwszego działania i opisz, co dzieje się dalej..."
        helper="Uwzględnij kolejność działań, uczestników, decyzje, przekazania, wykorzystywane systemy i pojawiające się problemy."
      />
      <div className="as-is-tip">
        <span aria-hidden="true">✦</span>
        <p>
          <strong>Opis nie musi być idealnie uporządkowany.</strong>
          Zapisz to, co wiesz. Na kolejnych etapach pomożemy uporządkować zebrane
          informacje.
        </p>
      </div>
    </div>
  )
}

function BpmnStepEditor({ draft, onChange, prefix }) {
  const documents = getBpmnDocuments(draft)
  const changeDocuments = (value) => onChange({ target: { name: 'bpmnDocuments', value } })
  const changeDocument = (index, field, value) => changeDocuments(
    documents.map((document, i) => i === index ? { ...document, [field]: value } : document),
  )
  return <>
    <SelectField
      id="bpmnTaskType"
      label="Typ zadania BPMN"
      value={draft.bpmnTaskType ?? ''}
      onChange={onChange}
      options={Object.entries(bpmnTaskTypes).map(([value, { label }]) => ({ value, label }))}
      placeholder="Ogólne"
    />
    <details className="bpmn-step-editor">
      <summary>Dokumenty i szczegóły wykonania</summary>
      {documents.map((document, index) => (
        <fieldset key={index}>
          <legend>{bpmnDocumentDirections[document.direction]} · dokument {index + 1}</legend>
          <div className="form-grid">
            {[
              ['name', 'Nazwa dokumentu', 'np. Zgłoszenie pracownika'],
              ['format', 'Format', 'np. papier, skan, PDF, formularz'],
              ['channel', 'Kanał przekazania', 'np. osobiście, e-mail, integracja'],
            ].map(([field, label, placeholder]) => <FormField
              key={field}
              id={`${prefix}-${field}-${index}`}
              label={`${label} — dokument ${index + 1}`}
              value={document[field] ?? ''}
              required={field === 'name'}
              placeholder={placeholder}
              onChange={(event) => changeDocument(index, field, event.target.value)}
            />)}
          </div>
          <button type="button" className="back-button" onClick={() => changeDocuments(documents.filter((_, i) => i !== index))}>
            Usuń dokument {index + 1}
          </button>
        </fieldset>
      ))}
      <div className="bpmn-actions">
        {Object.entries(bpmnDocumentDirections).map(([direction, label]) => <button
          key={direction}
          type="button"
          className="back-button"
          onClick={() => changeDocuments([...documents, { direction, name: '', format: '', channel: '' }])}
        >Dodaj dokument — {label.toLocaleLowerCase('pl')}</button>)}
      </div>
      <div className="form-grid">
        {bpmnStepFields.map(([id, label]) => <FormField key={id} id={id} label={label} value={draft[id] ?? ''} onChange={onChange} />)}
      </div>
    </details>
  </>
}

function StepsAsIs({
  stepDraft,
  stepError,
  steps,
  editingStepId,
  onStepChange,
  onAddStep,
  onEditStep,
  onDeleteStep,
  onMoveStep,
  onCancelEdit,
}) {
  return (
    <div className="as-is-editor">
      <div className="form-section-title">
        <span>01</span>
        <div>
          <h2>{editingStepId ? 'Edytuj krok procesu' : 'Dodaj kolejny krok'}</h2>
          <p>Każdy krok powinien opisywać jedno konkretne działanie.</p>
        </div>
      </div>

      <div className="step-form-panel">
        <div className="form-grid step-form-grid">
          <FormField
            id="stepName"
            label="Nazwa kroku"
            value={stepDraft.name}
            onChange={onStepChange}
            error={stepDraft.name.trim() ? '' : stepError}
            required
            placeholder="np. Weryfikacja zamówienia"
          />
          <FormField
            id="stepOwner"
            label="Osoba lub rola odpowiedzialna"
            value={stepDraft.owner}
            onChange={onStepChange}
            placeholder="np. Specjalista ds. sprzedaży"
          />
          <FormField
            id="stepDescription"
            label="Opis czynności"
            value={stepDraft.description}
            onChange={onStepChange}
            placeholder="Co dokładnie dzieje się w tym kroku?"
            multiline
          />
          <div className="step-side-fields">
            <FormField
              id="stepSystem"
              label="Wykorzystywany system lub narzędzie"
              value={stepDraft.system}
              onChange={onStepChange}
              placeholder="np. CRM, arkusz, e-mail"
            />
            <FormField
              id="stepResult"
              label="Rezultat kroku"
              value={stepDraft.result}
              onChange={onStepChange}
              placeholder="Co powstaje po wykonaniu kroku?"
            />
          </div>
        </div>
        <BpmnStepEditor draft={stepDraft} onChange={onStepChange} prefix="as-is-bpmn" />
        {stepDraft.name.trim() && stepError && <p className="error-message" role="alert">{stepError}</p>}
        <div className="step-form-actions">
          {editingStepId && (
            <button className="cancel-edit-button" type="button" onClick={onCancelEdit}>
              Anuluj edycję
            </button>
          )}
          <button className="add-step-button" type="button" onClick={onAddStep}>
            <span aria-hidden="true">{editingStepId ? '✓' : '+'}</span>
            {editingStepId ? 'Zapisz zmiany' : 'Dodaj krok'}
          </button>
        </div>
      </div>

      <div className="steps-list-section">
        <div className="steps-list-heading">
          <div>
            <h2>Kroki procesu</h2>
            <p>Uporządkuj je zgodnie z rzeczywistą kolejnością.</p>
          </div>
          <span>{steps.length} {steps.length === 1 ? 'krok' : 'kroków'}</span>
        </div>

        {steps.length === 0 ? (
          <div className="empty-steps">
            <span aria-hidden="true">1</span>
            <strong>Nie dodano jeszcze żadnego kroku</strong>
            <p>Uzupełnij nazwę pierwszego kroku i wybierz „Dodaj krok”.</p>
          </div>
        ) : (
          <ol className="steps-list">
            {steps.map((step, index) => (
              <li className={editingStepId === step.id ? 'is-editing' : ''} key={step.id}>
                <span className="step-order">{index + 1}</span>
                <div className="step-details">
                  <strong>{step.name}</strong>
                  {step.description && <p>{step.description}</p>}
                  <div className="step-meta">
                    {step.owner && <span>Rola: {step.owner}</span>}
                    {step.system && <span>Narzędzie: {step.system}</span>}
                    {step.result && <span>Rezultat: {step.result}</span>}
                  </div>
                </div>
                <div className="step-actions" aria-label={`Akcje kroku ${index + 1}`}>
                  <button
                    type="button"
                    onClick={() => onMoveStep(index, -1)}
                    disabled={index === 0}
                    aria-label="Przesuń krok w górę"
                    title="Przesuń w górę"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveStep(index, 1)}
                    disabled={index === steps.length - 1}
                    aria-label="Przesuń krok w dół"
                    title="Przesuń w dół"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditStep(step)}
                    aria-label={`Edytuj krok ${step.name}`}
                    title="Edytuj"
                  >
                    ✎
                  </button>
                  <button
                    className="delete-step"
                    type="button"
                    onClick={() => onDeleteStep(step.id)}
                    aria-label={`Usuń krok ${step.name}`}
                    title="Usuń"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function AsIsScreen({
  processId,
  workshopDirtyRef,
  workshopRecordingRef,
  onTransferWorkshopSteps,
  onUseWorkshopFinding,
  onAddConnection,
  onRemoveConnection,
  onSaveBpmnDecision,
  onSaveBpmnLane,
  onAddBpmnMessage,
  onRemoveBpmnMessage,
  externalSteps,
  externalLinks,
  onExternalLinksChange,
  onExternalStepsChange,
  onBpmnDraftChange,
  bpmnDraftDirty,
  scope,
  startMethod,
  description,
  descriptionError,
  steps,
  stepDraft,
  stepError,
  editingStepId,
  asIsError,
  saved,
  saveError,
  onDescriptionChange,
  onStepChange,
  onAddStep,
  onEditStep,
  onDeleteStep,
  onMoveStep,
  onCancelEdit,
  onBack,
  onSave,
  onContinue,
}) {
  const isStepsVariant = startMethod === 'steps'
  const [workshopDecisionSource, setWorkshopDecisionSource] = useState(null)
  const workshopDecisions = workshopDecisionSource?.processId === processId ? workshopDecisionSource?.decisions : undefined

  return (
    <section className="workspace as-is-workspace" aria-labelledby="as-is-title">
      <div className="as-is-intro">
        <div>
          <span className="eyebrow">
            <CompassIcon />
            Etap 2 · Proces AS-IS
          </span>
          <h1 id="as-is-title">Pokaż, jak proces działa dzisiaj</h1>
          <p>
            Zapisz rzeczywisty przebieg procesu — także skróty, wyjątki i problemy,
            które pojawiają się w codziennej pracy.
          </p>
        </div>
        <span className="selected-path">
          <span aria-hidden="true">✓</span>
          Sposób pracy:{' '}
          <strong>
            {isStepsVariant ? 'Dodaj kroki samodzielnie' : 'Opisz cały proces'}
          </strong>
        </span>
      </div>

      <ScopeSummary scope={scope} />

      {processId && <WorkshopPanel key={processId} processId={processId} processName={scope.processName} dirtyRef={workshopDirtyRef} recordingRef={workshopRecordingRef} autosaveDraft canTransferSteps={isStepsVariant} onTransferSteps={onTransferWorkshopSteps} onUseFinding={onUseWorkshopFinding} onDecisionSourceChange={setWorkshopDecisionSource} />}

      {isStepsVariant ? (
        <>
        <StepsAsIs
          stepDraft={stepDraft}
          stepError={stepError}
          steps={steps}
          editingStepId={editingStepId}
          onStepChange={onStepChange}
          onAddStep={onAddStep}
          onEditStep={onEditStep}
          onDeleteStep={onDeleteStep}
          onMoveStep={onMoveStep}
          onCancelEdit={onCancelEdit}
        />
        <ProcessConnections steps={steps} onAdd={onAddConnection} onRemove={onRemoveConnection} />
        <BpmnDecisions steps={steps} workshopDecisions={workshopDecisions} onSave={onSaveBpmnDecision} onDraftChange={onBpmnDraftChange} />
        <BpmnLanes steps={steps} onSave={onSaveBpmnLane} onDraftChange={onBpmnDraftChange} />
        <BpmnExternalSteps externalLinks={externalLinks} steps={steps} externalSteps={externalSteps} onChange={onExternalStepsChange} onDraftChange={onBpmnDraftChange} />
        <BpmnMessages steps={steps} externalSteps={externalSteps} onAdd={onAddBpmnMessage} onRemove={onRemoveBpmnMessage} onDraftChange={onBpmnDraftChange} />
        <BpmnExternalMessages externalSteps={externalSteps} steps={steps} links={externalLinks} onChange={onExternalLinksChange} onDraftChange={onBpmnDraftChange} variant="AS-IS" />
        <BpmnExport steps={steps} externalSteps={externalSteps} externalLinks={externalLinks} scope={scope} saved={saved && !bpmnDraftDirty} />
        </>
      ) : (
        <DescribeAsIs
          description={description}
          error={descriptionError}
          onChange={onDescriptionChange}
        />
      )}

      {asIsError && (
        <div className="save-message storage-error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>{asIsError}</strong>
            <small>Uzupełnij wymagane dane i spróbuj ponownie.</small>
          </div>
        </div>
      )}

      {saved && (
        <div className="save-message success-message" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Proces AS-IS został zapisany</strong>
            <small>Możesz nadal uzupełniać lub poprawiać dane.</small>
          </div>
        </div>
      )}

      {saveError && (
        <div className="save-message storage-error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Nie udało się zapisać procesu AS-IS</strong>
            <small>Sprawdź ustawienia przeglądarki i spróbuj ponownie.</small>
          </div>
        </div>
      )}

      <div className="form-actions">
        <button className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          Wróć do zakresu
        </button>
        <button className="save-button" type="button" onClick={onSave}>
          Zapisz proces AS-IS
          <span aria-hidden="true">✓</span>
        </button>
        {saved && (
          <button className="continue-button" type="button" onClick={onContinue}>
            Przejdź do analizy
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </section>
  )
}

function AnalysisContext({ scope, startMethod, steps }) {
  const contextItems = [
    ['Proces', scope.processName, 'P'],
    [
      'Sposób opisu AS-IS',
      startMethod === 'steps' ? 'Lista kroków' : 'Opis całego procesu',
      'A',
    ],
    ['Początek', scope.processStart, '↗'],
    ['Koniec', scope.processEnd, '✓'],
  ]

  if (startMethod === 'steps') {
    contextItems.push(['Liczba kroków', String(steps.length), '#'])
  }

  return (
    <aside
      className={`analysis-context ${startMethod === 'steps' ? 'with-steps' : ''}`}
      aria-label="Podsumowanie procesu do analizy"
    >
      {contextItems.map(([label, value, icon]) => (
        <div className="context-item" key={label}>
          <span className="summary-icon" aria-hidden="true">{icon}</span>
          <span>
            <small>{label}</small>
            <strong>{value}</strong>
          </span>
        </div>
      ))}
    </aside>
  )
}

function FindingsSummary({ findings }) {
  const stats = [
    ['Wszystkie ustalenia', findings.length, '∑'],
    [
      'Wąskie gardła',
      findings.filter((finding) => finding.category === 'Wąskie gardło').length,
      '⌛',
    ],
    [
      'Ryzyka',
      findings.filter(
        (finding) => finding.category === 'Ryzyko lub możliwość błędu',
      ).length,
      '!',
    ],
    [
      'Automatyzacja',
      findings.filter(
        (finding) => finding.category === 'Miejsce do automatyzacji',
      ).length,
      '⚙',
    ],
    [
      'Wysoki wpływ',
      findings.filter((finding) => finding.impactLevel === 'Wysoki').length,
      '↑',
    ],
  ]

  return (
    <section className="analysis-summary" aria-labelledby="analysis-summary-title">
      <div className="steps-list-heading">
        <div>
          <h2 id="analysis-summary-title">Podsumowanie analizy</h2>
          <p>Najważniejsze liczby wynikające z dodanych ustaleń.</p>
        </div>
      </div>
      <div className="analysis-stats">
        {stats.map(([label, count, icon]) => (
          <div className="analysis-stat" key={label}>
            <span aria-hidden="true">{icon}</span>
            <strong>{count}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

function FindingForm({
  draft,
  errors,
  startMethod,
  steps,
  editingId,
  workshopExceptions,
  onUseWorkshopException,
  onChange,
  onSubmit,
  onCancel,
}) {
  const [selectedException, setSelectedException] = useState('')
  const stepOptions = steps.map((step, index) => ({
    value: step.id,
    label: `${index + 1}. ${step.name}`,
  }))

  return (
    <section className="finding-editor" aria-labelledby="finding-form-title">
      <div className="form-section-title">
        <span>01</span>
        <div>
          <h2 id="finding-form-title">
            {editingId ? 'Edytuj ustalenie' : 'Co zauważasz w obecnym procesie?'}
          </h2>
          <p>Zapisz problem, ryzyko lub szansę na usprawnienie procesu.</p>
        </div>
      </div>

      <div className="finding-form-panel">
        {workshopExceptions.length > 0 && <div className="form-grid">
          <SelectField
            id="findingWorkshopException"
            label="Sprawdzony wyjątek z warsztatu"
            value={selectedException}
            options={workshopExceptions}
            onChange={(event) => setSelectedException(event.target.value)}
            placeholder="Wybierz wyjątek"
          />
          <div className="step-form-actions">
            <button className="back-button" type="button" disabled={!selectedException} onClick={() => {
              if (onUseWorkshopException(selectedException)) setSelectedException('')
            }}>Wstaw wyjątek do formularza</button>
          </div>
        </div>}
        <div className="form-grid">
          <SelectField
            id="findingCategory"
            label="Kategoria"
            value={draft.category}
            onChange={onChange}
            options={findingCategories}
            error={errors.category}
            required
          />
          <FormField
            id="findingName"
            label="Nazwa problemu lub obserwacji"
            value={draft.name}
            onChange={onChange}
            error={errors.name}
            required
            placeholder="Krótko nazwij swoje spostrzeżenie"
          />
          {startMethod === 'steps' ? (
            <SelectField
              id="findingLocation"
              label="Gdzie występuje?"
              value={draft.location}
              onChange={onChange}
              options={stepOptions}
              placeholder="Wybierz krok procesu"
            />
          ) : (
            <FormField
              id="findingLocation"
              label="Gdzie występuje?"
              value={draft.location}
              onChange={onChange}
              placeholder="Wskaż fragment lub etap procesu"
            />
          )}
          <SelectField
            id="findingImpactLevel"
            label="Poziom wpływu"
            value={draft.impactLevel}
            onChange={onChange}
            options={impactLevels}
            placeholder=""
          />
          <FormField
            id="findingSituation"
            label="Opis obecnej sytuacji"
            value={draft.situation}
            onChange={onChange}
            placeholder="Co dokładnie dzieje się obecnie?"
            multiline
          />
          <FormField
            id="findingCause"
            label="Możliwa przyczyna"
            value={draft.cause}
            onChange={onChange}
            placeholder="Z czego może wynikać ta sytuacja?"
            multiline
          />
          <FormField
            id="findingProcessImpact"
            label="Wpływ na proces"
            value={draft.processImpact}
            onChange={onChange}
            placeholder="Jakie są konsekwencje dla czasu, jakości lub kosztu?"
            multiline
          />
          <FormField
            id="findingImprovement"
            label="Wstępny pomysł usprawnienia"
            value={draft.improvement}
            onChange={onChange}
            placeholder="Co można byłoby zmienić?"
            multiline
          />
        </div>

        <div className="step-form-actions">
          {editingId && (
            <button className="cancel-edit-button" type="button" onClick={onCancel}>
              Anuluj edycję
            </button>
          )}
          <button className="add-step-button" type="button" onClick={onSubmit}>
            <span aria-hidden="true">{editingId ? '✓' : '+'}</span>
            {editingId ? 'Zapisz zmiany' : 'Dodaj ustalenie'}
          </button>
        </div>
      </div>
    </section>
  )
}

function FindingsList({ findings, steps, startMethod, editingId, onEdit, onDelete }) {
  const getLocationLabel = (finding) => {
    if (!finding.location) {
      return 'Nie wskazano miejsca'
    }
    if (startMethod !== 'steps') {
      return finding.location
    }
    const stepIndex = steps.findIndex((step) => step.id === finding.location)
    return stepIndex >= 0
      ? `${stepIndex + 1}. ${steps[stepIndex].name}`
      : 'Krok usunięty lub niedostępny'
  }

  return (
    <section className="findings-section" aria-labelledby="findings-list-title">
      <div className="steps-list-heading">
        <div>
          <h2 id="findings-list-title">Ustalenia analityczne</h2>
          <p>Lista problemów i możliwości zauważonych w obecnym procesie.</p>
        </div>
        <span>{findings.length} {findings.length === 1 ? 'ustalenie' : 'ustaleń'}</span>
      </div>

      {findings.length === 0 ? (
        <div className="empty-steps finding-empty">
          <span aria-hidden="true">?</span>
          <strong>Nie dodano jeszcze żadnego ustalenia</strong>
          <p>Uzupełnij kategorię i nazwę pierwszej obserwacji.</p>
        </div>
      ) : (
        <div className="findings-list">
          {findings.map((finding, index) => (
            <article
              className={`finding-card ${editingId === finding.id ? 'is-editing' : ''}`}
              key={finding.id}
            >
              <div className="finding-card-header">
                <span className="finding-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <span className="category-badge">{finding.category}</span>
                  <h3>{finding.name}</h3>
                </div>
                <span
                  className={`impact-badge impact-${finding.impactLevel.toLowerCase()}`}
                >
                  {finding.impactLevel} wpływ
                </span>
              </div>
              <div className="finding-location">
                <span aria-hidden="true">⌖</span>
                <strong>Gdzie:</strong> {getLocationLabel(finding)}
              </div>
              <div className="finding-details">
                {finding.situation && (
                  <div>
                    <small>Obecna sytuacja</small>
                    <p>{finding.situation}</p>
                  </div>
                )}
                {finding.cause && (
                  <div>
                    <small>Możliwa przyczyna</small>
                    <p>{finding.cause}</p>
                  </div>
                )}
                {finding.processImpact && (
                  <div>
                    <small>Wpływ na proces</small>
                    <p>{finding.processImpact}</p>
                  </div>
                )}
                {finding.improvement && (
                  <div>
                    <small>Pomysł usprawnienia</small>
                    <p>{finding.improvement}</p>
                  </div>
                )}
              </div>
              <div className="finding-actions">
                <button type="button" onClick={() => onEdit(finding)}>
                  <span aria-hidden="true">✎</span>
                  Edytuj
                </button>
                <button
                  className="delete-finding"
                  type="button"
                  onClick={() => onDelete(finding.id)}
                >
                  <span aria-hidden="true">×</span>
                  Usuń
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function AnalysisScreen({
  processId,
  scope,
  startMethod,
  steps,
  findings,
  draft,
  errors,
  editingId,
  analysisError,
  saved,
  saveError,
  onChange,
  onUseWorkshopException,
  onAdd,
  onEdit,
  onDelete,
  onCancelEdit,
  onBack,
  onSave,
  onContinue,
}) {
  const [workshopExceptions] = useState(() => {
    if (!processId) return []
    try {
      const { transcript } = loadWorkshop(localStorage, processId)
      const { review } = loadWorkshopReview(localStorage, processId, transcript)
      return [...new Set((review?.exceptions ?? []).filter((item) => item.reviewed === true)
        .map(({ text }) => text.trim().replace(/\s+/g, ' ')))]
    } catch {
      return []
    }
  })
  return (
    <section className="workspace analysis-workspace" aria-labelledby="analysis-title">
      <div className="analysis-intro">
        <div>
          <span className="eyebrow">
            <CompassIcon />
            Etap 3 · Analiza procesu
          </span>
          <h1 id="analysis-title">Znajdź miejsca, które warto usprawnić</h1>
          <p>
            Zapisz problemy, ryzyka i szanse zauważone w obecnym przebiegu procesu.
            Każde ustalenie stanie się punktem wyjścia do projektu TO-BE.
          </p>
        </div>
      </div>

      <AnalysisContext scope={scope} startMethod={startMethod} steps={steps} />

      <FindingForm
        draft={draft}
        errors={errors}
        startMethod={startMethod}
        steps={steps}
        editingId={editingId}
        workshopExceptions={workshopExceptions}
        onUseWorkshopException={onUseWorkshopException}
        onChange={onChange}
        onSubmit={onAdd}
        onCancel={onCancelEdit}
      />

      <FindingsList
        findings={findings}
        steps={steps}
        startMethod={startMethod}
        editingId={editingId}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      <FindingsSummary findings={findings} />

      {analysisError && (
        <div className="save-message storage-error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>{analysisError}</strong>
            <small>Dodaj pierwsze ustalenie i spróbuj ponownie.</small>
          </div>
        </div>
      )}

      {saved && (
        <div className="save-message success-message" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Analiza procesu została zapisana</strong>
            <small>Możesz nadal uzupełniać lub poprawiać ustalenia.</small>
          </div>
        </div>
      )}

      {saveError && (
        <div className="save-message storage-error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Nie udało się zapisać analizy</strong>
            <small>Sprawdź ustawienia przeglądarki i spróbuj ponownie.</small>
          </div>
        </div>
      )}

      <div className="form-actions">
        <button className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          Wróć do AS-IS
        </button>
        <button className="save-button" type="button" onClick={onSave}>
          Zapisz analizę
          <span aria-hidden="true">✓</span>
        </button>
        {saved && findings.length > 0 && (
          <button className="continue-button" type="button" onClick={onContinue}>
            Przejdź do TO-BE
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </section>
  )
}

function ToBeContext({ scope, startMethod, findings }) {
  const items = [
    ['Proces', scope.processName, 'P'],
    ['Początek', scope.processStart, '↗'],
    ['Koniec', scope.processEnd, '✓'],
    [
      'Opis AS-IS',
      startMethod === 'steps' ? 'Lista kroków' : 'Opis całego procesu',
      'A',
    ],
    ['Ustalenia', String(findings.length), '#'],
  ]

  return (
    <aside className="analysis-context with-steps to-be-context" aria-label="Podsumowanie procesu">
      {items.map(([label, value, icon]) => (
        <div className="context-item" key={label}>
          <span className="summary-icon" aria-hidden="true">{icon}</span>
          <span>
            <small>{label}</small>
            <strong>{value}</strong>
          </span>
        </div>
      ))}
    </aside>
  )
}

function ToBeAssumptions({ assumptions, error, onChange }) {
  return (
    <section className="to-be-section" aria-labelledby="assumptions-title">
      <div className="form-section-title">
        <span>01</span>
        <div>
          <h2 id="assumptions-title">Założenia procesu docelowego</h2>
          <p>Określ kierunek projektowanej zmiany i sposób oceny jej efektów.</p>
        </div>
      </div>
      <div className="form-grid">
        <FormField
          id="toBeChangeGoal"
          label="Cel projektowanej zmiany"
          value={assumptions.changeGoal}
          onChange={onChange}
          error={error}
          required
          placeholder="Co przede wszystkim chcesz zmienić?"
          multiline
        />
        <FormField
          id="toBeExpectedResult"
          label="Oczekiwany rezultat"
          value={assumptions.expectedResult}
          onChange={onChange}
          placeholder="Jak powinien wyglądać efekt usprawnienia?"
          multiline
        />
        <FormField
          id="toBeConstraints"
          label="Najważniejsze ograniczenia lub warunki"
          value={assumptions.constraints}
          onChange={onChange}
          placeholder="Budżet, czas, regulacje, dostępne zasoby..."
          multiline
        />
        <FormField
          id="toBeSuccessMeasures"
          label="Mierniki sukcesu procesu"
          value={assumptions.successMeasures}
          onChange={onChange}
          placeholder="Po czym poznasz, że zmiana zadziałała?"
          multiline
        />
      </div>
    </section>
  )
}

function getToBeFindingIds(step) {
  const additional = Array.isArray(step.additionalFindingIds) ? step.additionalFindingIds : []
  return [...new Set([step.findingId, ...additional].filter((id) => typeof id === 'string' && id))]
}

function getToBeStepsByFinding(steps) {
  const byFinding = new Map()
  for (const step of steps) {
    for (const id of getToBeFindingIds(step)) {
      const linked = byFinding.get(id) ?? []
      linked.push(step.name)
      byFinding.set(id, linked)
    }
  }
  return byFinding
}

function getLinkedToBeFindings(step, findingsById) {
  return getToBeFindingIds(step).map((id) => findingsById.get(id)).filter(Boolean)
}

function IncludedFindings({
  findings,
  selectedIds,
  asIsSteps,
  toBeSteps,
  startMethod,
  onToggle,
}) {
  const stepsByFinding = getToBeStepsByFinding(toBeSteps)
  const locationLabel = (finding) => {
    if (!finding.location) return 'Nie wskazano miejsca'
    if (startMethod !== 'steps') return finding.location
    const index = asIsSteps.findIndex((step) => step.id === finding.location)
    return index >= 0 ? `${index + 1}. ${asIsSteps[index].name}` : 'Krok niedostępny'
  }

  return (
    <section className="to-be-section included-findings" aria-labelledby="included-title">
      <div className="form-section-title">
        <span>02</span>
        <div>
          <h2 id="included-title">Ustalenia do uwzględnienia</h2>
          <p>Wybierz obserwacje, na które powinien odpowiadać proces docelowy.</p>
        </div>
      </div>
      <div className="to-be-findings-list">
        {findings.map((finding) => {
          const checked = selectedIds.includes(finding.id)
          const linkedSteps = stepsByFinding.get(finding.id)
          return (
            <label className={`to-be-finding ${checked ? 'selected' : ''}`} key={finding.id}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(finding.id)}
              />
              <span className="custom-checkbox" aria-hidden="true">✓</span>
              <span className="to-be-finding-content">
                <span>
                  <span className="category-badge">{finding.category}</span>
                  <span className={`impact-badge impact-${finding.impactLevel.toLowerCase()}`}>
                    {finding.impactLevel}
                  </span>
                </span>
                <strong>{finding.name}</strong>
                <small>Gdzie: {locationLabel(finding)}</small>
                {finding.improvement && <p>Pomysł: {finding.improvement}</p>}
                {linkedSteps && <small>Powiązane kroki TO-BE: {linkedSteps.join(', ')}</small>}
                {checked && !linkedSteps && <small>Brak powiązanego kroku TO-BE</small>}
                <em>Uwzględnij w procesie TO-BE</em>
              </span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

function ToBeStepEditor({
  draft,
  error,
  findings,
  editingId,
  startMethod,
  hasSteps,
  hasExternalParticipants,
  copyMessage,
  copyError,
  onChange,
  onAdd,
  onCancel,
  onCopy,
  onUseImprovement,
  onUseSuggestion,
  onToggleAdditionalFinding,
}) {
  const additionalOptions = findings.filter(({ id }) => id !== draft.findingId)
  const linkedFinding = findings.find((finding) => finding.id === draft.findingId)
  const idea = linkedFinding?.improvement
  const improvement = typeof idea === 'string' ? idea.trim().replace(/\s+/g, ' ') : ''
  const useImprovement = () => {
    if (!improvement || improvement === draft.name.trim()) return
    if (draft.name.trim() && !window.confirm('Zastąpić bieżącą nazwę kroku pomysłem z analizy?')) return
    onUseImprovement(improvement)
    document.getElementById('toBeStepName')?.focus()
  }

  const findingOptions = findings.map((finding) => ({
    value: finding.id,
    label: finding.name,
  }))
  const suggestion = getToBeStepSuggestion(linkedFinding)
  const suggestedFields = Object.fromEntries(
    Object.entries(suggestion ?? {}).filter(([field]) => !draft[field]?.trim()),
  )

  return (
    <section className="to-be-section to-be-steps-editor" aria-labelledby="to-be-step-title">
      <div className="to-be-step-heading">
        <div className="form-section-title">
          <span>03</span>
          <div>
            <h2 id="to-be-step-title">
              {editingId ? 'Edytuj krok TO-BE' : 'Zaprojektuj kroki procesu TO-BE'}
            </h2>
            <p>Proces docelowy zawsze budujemy jako uporządkowaną listę kroków.</p>
          </div>
        </div>
        {startMethod === 'steps' && <div className="bpmn-actions">
          <button className="copy-steps-button" type="button" onClick={() => onCopy()} disabled={hasSteps}>
            Skopiuj kroki z AS-IS
          </button>
          <button className="copy-steps-button" type="button" onClick={() => onCopy({ includeBpmn: true })}
            disabled={hasSteps || hasExternalParticipants}>
            Skopiuj mapę BPMN z AS-IS
          </button>
        </div>}
      </div>

      {copyMessage && (
        <div className="inline-message copied-message" role="status">
          <span aria-hidden="true">✓</span>
          {copyMessage}
        </div>
      )}
      {copyError && (
        <div className="inline-message copy-error" role="alert">
          <span aria-hidden="true">!</span>
          {copyError}
        </div>
      )}

      <div className="step-form-panel to-be-step-panel">
        <div className="form-grid">
          <FormField
            id="toBeStepName"
            label="Nazwa kroku"
            value={draft.name}
            onChange={onChange}
            error={draft.name.trim() ? '' : error}
            required
            placeholder="np. Automatyczna weryfikacja zamówienia"
          />
          <FormField
            id="toBeStepOwner"
            label="Osoba lub rola odpowiedzialna"
            value={draft.owner}
            onChange={onChange}
            placeholder="Kto odpowiada za ten krok?"
          />
          <FormField
            id="toBeStepDescription"
            label="Opis czynności"
            value={draft.description}
            onChange={onChange}
            placeholder="Jak krok powinien przebiegać?"
            multiline
          />
          <div className="step-side-fields">
            <FormField
              id="toBeStepSystem"
              label="Wykorzystywany system lub narzędzie"
              value={draft.system}
              onChange={onChange}
              placeholder="np. CRM, ERP, automatyzacja"
            />
            <FormField
              id="toBeStepResult"
              label="Rezultat kroku"
              value={draft.result}
              onChange={onChange}
              placeholder="Co powstaje po wykonaniu kroku?"
            />
          </div>
          <SelectField
            id="toBeStepType"
            label="Rodzaj kroku"
            value={draft.stepType}
            onChange={onChange}
            options={['Nowy', 'Zmieniony', 'Bez zmian']}
            placeholder=""
          />
          <div>
            <SelectField
              id="toBeStepFinding"
              label="Powiązane usprawnienie"
              value={draft.findingId}
              onChange={onChange}
              options={findingOptions}
              placeholder="Brak powiązania"
            />
            {improvement && <div className="bpmn-actions">
              <button type="button" className="back-button" disabled={improvement === draft.name.trim()}
                onClick={useImprovement}>Użyj pomysłu jako nazwy kroku</button>
            </div>}
            {additionalOptions.length > 0 && <details>
              <summary>Dodatkowe ustalenia</summary>
              <div className="step-side-fields">
                {additionalOptions.map(({ id, name }) => <label key={id}>
                  <input type="checkbox" checked={draft.additionalFindingIds.includes(id)}
                    onChange={() => onToggleAdditionalFinding(id)} /> {name}
                </label>)}
              </div>
            </details>}
          </div>
          <SelectField
            id="toBeStepAutomatable"
            label="Czy krok może zostać zautomatyzowany?"
            value={draft.automatable}
            onChange={onChange}
            options={['Tak', 'Nie']}
            placeholder=""
          />
        </div>
        {suggestion && (
          <aside className="to-be-step-suggestion" aria-label="Podpowiedź z analizy">
            <strong>{suggestion.name}</strong>
            <p>{suggestion.description}</p>
            <p>{suggestion.result}</p>
            <button type="button" className="back-button" disabled={!Object.keys(suggestedFields).length} onClick={() => {
              onUseSuggestion(suggestedFields)
              document.getElementById('toBeStepName')?.focus()
            }}>Uzupełnij puste pola propozycją</button>
          </aside>
        )}
        <BpmnStepEditor draft={draft} onChange={onChange} prefix="to-be-bpmn" />
        {draft.name.trim() && error && <p className="error-message" role="alert">{error}</p>}
        <div className="step-form-actions">
          {editingId && (
            <button className="cancel-edit-button" type="button" onClick={onCancel}>
              Anuluj edycję
            </button>
          )}
          <button className="add-step-button" type="button" onClick={onAdd}>
            <span aria-hidden="true">{editingId ? '✓' : '+'}</span>
            {editingId ? 'Zapisz zmiany' : 'Dodaj krok'}
          </button>
        </div>
      </div>
    </section>
  )
}

function ToBeStepsList({
  steps,
  findings,
  editingId,
  error,
  onEdit,
  onDelete,
  deleteDisabled,
  onMove,
}) {
  const findingsById = new Map(findings.map((finding) => [finding.id, finding]))

  return (
    <section className="to-be-section to-be-list-section" aria-labelledby="to-be-list-title">
      <div className="steps-list-heading">
        <div>
          <h2 id="to-be-list-title">Kroki procesu docelowego</h2>
          <p>Ułóż działania w kolejności, w której powinny być wykonywane.</p>
        </div>
        <span>{steps.length} {steps.length === 1 ? 'krok' : 'kroków'}</span>
      </div>

      {error && (
        <div className="inline-message copy-error steps-validation-error" role="alert">
          <span aria-hidden="true">!</span>
          {error}
        </div>
      )}

      {steps.length === 0 ? (
        <div className="empty-steps">
          <span aria-hidden="true">1</span>
          <strong>Proces TO-BE nie ma jeszcze kroków</strong>
          <p>Dodaj pierwszy krok lub skopiuj istniejące kroki z AS-IS.</p>
        </div>
      ) : (
        <ol className="to-be-steps-list">
          {steps.map((step, index) => (
            <li className={editingId === step.id ? 'is-editing' : ''} key={step.id}>
              <span className="step-order">{index + 1}</span>
              <div className="to-be-step-content">
                <div className="to-be-step-title">
                  <strong>{step.name}</strong>
                  <span className={`step-type type-${step.stepType.toLowerCase().replace(' ', '-')}`}>
                    {step.stepType}
                  </span>
                  {step.automatable === 'Tak' && (
                    <span className="automation-badge">⚙ Możliwa automatyzacja</span>
                  )}
                </div>
                {step.description && <p>{step.description}</p>}
                <div className="step-meta">
                  {step.owner && <span>Rola: {step.owner}</span>}
                  {step.system && <span>Narzędzie: {step.system}</span>}
                  {step.result && <span>Rezultat: {step.result}</span>}
                  {getLinkedToBeFindings(step, findingsById).map(({ id, name }) => (
                    <span key={id}>Usprawnienie: {name}</span>
                  ))}
                </div>
              </div>
              <div className="step-actions">
                <button
                  type="button"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0}
                  aria-label="Przesuń krok w górę"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, 1)}
                  disabled={index === steps.length - 1}
                  aria-label="Przesuń krok w dół"
                >
                  ↓
                </button>
                <button type="button" onClick={() => onEdit(step)} aria-label="Edytuj krok">
                  ✎
                </button>
                <button
                  className="delete-step"
                  type="button"
                  onClick={() => onDelete(step.id)}
                  disabled={deleteDisabled}
                  aria-label="Usuń krok"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function ToBeSummary({ steps, selectedCount }) {
  const stats = [
    ['Wszystkie kroki', steps.length, '∑'],
    ['Nowe', steps.filter((step) => step.stepType === 'Nowy').length, '+'],
    ['Zmienione', steps.filter((step) => step.stepType === 'Zmieniony').length, '↻'],
    ['Bez zmian', steps.filter((step) => step.stepType === 'Bez zmian').length, '='],
    [
      'Automatyzacja',
      steps.filter((step) => step.automatable === 'Tak').length,
      '⚙',
    ],
    ['Ustalenia', selectedCount, '✓'],
  ]

  return (
    <section className="analysis-summary to-be-summary" aria-labelledby="to-be-summary-title">
      <div className="steps-list-heading">
        <div>
          <h2 id="to-be-summary-title">Podsumowanie procesu TO-BE</h2>
          <p>Struktura projektowanego procesu docelowego.</p>
        </div>
      </div>
      <div className="analysis-stats to-be-stats">
        {stats.map(([label, count, icon]) => (
          <div className="analysis-stat" key={label}>
            <span aria-hidden="true">{icon}</span>
            <strong>{count}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

function ToBeScreen({
  scope,
  startMethod,
  asIsSteps,
  findings,
  assumptions,
  assumptionError,
  selectedFindingIds,
  steps,
  stepDraft,
  stepError,
  editingStepId,
  copyMessage,
  copyError,
  toBeError,
  saved,
  saveError,
  onAssumptionChange,
  onToggleFinding,
  onStepChange,
  onUseImprovement,
  onUseSuggestion,
  onToggleAdditionalFinding,
  onAddStep,
  onEditStep,
  onDeleteStep,
  onMoveStep,
  onCancelEdit,
  onCopySteps,
  onAddConnection,
  onRemoveConnection,
  onSaveBpmnDecision,
  externalSteps,
  externalLinks,
  onExternalLinksChange,
  onSaveBpmnLane,
  onExternalStepsChange,
  onAddBpmnMessage,
  onRemoveBpmnMessage,
  onBack,
  onSave,
  onContinue,
}) {
  const [bpmnDrafts, setBpmnDrafts] = useState({})
  const bpmnDraftDirty = Object.values(bpmnDrafts).some(Boolean)
  const markBpmnDraft = (id, dirty) => setBpmnDrafts((current) => ({ ...current, [id]: dirty }))
  const displaySteps = startMethod === 'steps'
    ? withDetectedStepChanges(steps, compareProcessSteps(asIsSteps, steps))
    : steps
  return (
    <section className="workspace to-be-workspace" aria-labelledby="to-be-title">
      <div className="analysis-intro">
        <span className="eyebrow">
          <CompassIcon />
          Etap 4 · Proces TO-BE
        </span>
        <h1 id="to-be-title">Zaprojektuj proces po usprawnieniach</h1>
        <p>
          Przełóż wnioski z analizy na prostszy, bardziej przewidywalny i skuteczny
          przebieg procesu docelowego.
        </p>
      </div>

      <ToBeContext scope={scope} startMethod={startMethod} findings={findings} />
      <ToBeAssumptions
        assumptions={assumptions}
        error={assumptionError}
        onChange={onAssumptionChange}
      />
      <IncludedFindings
        findings={findings}
        selectedIds={selectedFindingIds}
        asIsSteps={asIsSteps}
        toBeSteps={steps}
        startMethod={startMethod}
        onToggle={onToggleFinding}
      />
      <ToBeStepEditor
        draft={stepDraft}
        error={stepError}
        findings={findings}
        editingId={editingStepId}
        startMethod={startMethod}
        hasSteps={steps.length > 0}
        hasExternalParticipants={externalSteps.length > 0 || externalLinks.length > 0}
        copyMessage={copyMessage}
        copyError={copyError}
        onChange={onStepChange}
        onUseImprovement={onUseImprovement}
        onUseSuggestion={onUseSuggestion}
        onToggleAdditionalFinding={onToggleAdditionalFinding}
        onAdd={onAddStep}
        onCancel={onCancelEdit}
        onCopy={onCopySteps}
      />
      <ToBeStepsList
        steps={displaySteps}
        findings={findings}
        editingId={editingStepId}
        error={toBeError}
        onEdit={onEditStep}
        onDelete={onDeleteStep}
        deleteDisabled={bpmnDraftDirty}
        onMove={onMoveStep}
      />
      <ToBeSummary steps={displaySteps} selectedCount={selectedFindingIds.length} />
      {steps.length > 0 && <ProcessConnections steps={steps} variant="TO-BE" onAdd={onAddConnection} onRemove={(...args) => bpmnDraftDirty ? { error: 'Najpierw zapisz lub wyczyść niezakończony formularz BPMN.' } : onRemoveConnection(...args)} />}
      <BpmnDecisions steps={steps} variant="TO-BE" onSave={onSaveBpmnDecision} onDraftChange={markBpmnDraft} />
      <BpmnLanes steps={steps} variant="TO-BE" onSave={onSaveBpmnLane} onDraftChange={markBpmnDraft} />
      {steps.length > 0 && <BpmnExternalSteps externalLinks={externalLinks} steps={steps} externalSteps={externalSteps} variant="TO-BE" onChange={onExternalStepsChange} onDraftChange={markBpmnDraft} />}
      <BpmnMessages steps={steps} externalSteps={externalSteps} variant="TO-BE" onAdd={onAddBpmnMessage} onRemove={onRemoveBpmnMessage} onDraftChange={markBpmnDraft} />
      <BpmnExternalMessages externalSteps={externalSteps} steps={steps} links={externalLinks} onChange={onExternalLinksChange} onDraftChange={markBpmnDraft} variant="TO-BE" />
      <BpmnExport steps={steps} externalSteps={externalSteps} externalLinks={externalLinks} scope={scope} saved={saved && !bpmnDraftDirty} variant="to-be" />

      {saved && (
        <div className="save-message success-message" role="status">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Proces TO-BE został zapisany</strong>
            <small>Możesz nadal uzupełniać lub poprawiać projekt procesu.</small>
          </div>
        </div>
      )}
      {saveError && (
        <div className="save-message storage-error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Nie udało się zapisać procesu TO-BE</strong>
            <small>Sprawdź ustawienia przeglądarki i spróbuj ponownie.</small>
          </div>
        </div>
      )}

      <div className="form-actions">
        <button className="back-button" type="button" onClick={onBack} disabled={bpmnDraftDirty}>
          <span aria-hidden="true">←</span>
          Wróć do analizy
        </button>
        <button className="save-button" type="button" onClick={onSave} disabled={bpmnDraftDirty}>
          Zapisz proces TO-BE
          <span aria-hidden="true">✓</span>
        </button>
        {saved && !bpmnDraftDirty && assumptions.changeGoal.trim() && steps.length > 0 && (
          <button className="continue-button" type="button" onClick={onContinue}>
            Przejdź do raportu
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </section>
  )
}

function ReportSectionTitle({ number, title, description }) {
  return (
    <div className="form-section-title report-section-title">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  )
}

function ProcessReportSummary({
  scope,
  startMethod,
  asIsSteps,
  findings,
  toBeSteps,
  summaryId = 'report-summary-title',
}) {
  const items = [
    ['Nazwa procesu', scope.processName],
    ['Cel procesu', scope.processGoal],
    ['Właściciel procesu', scope.processOwner || 'Nie określono'],
    ['Początek procesu', scope.processStart],
    ['Koniec procesu', scope.processEnd],
    ['Odbiorca rezultatu', scope.customer || 'Nie określono'],
    ['Sposób opisu AS-IS', startMethod === 'steps' ? 'Lista kroków' : 'Opis tekstowy'],
    ...(startMethod === 'steps' ? [['Liczba kroków AS-IS', String(asIsSteps.length)]] : []),
    ['Ustalenia analityczne', String(findings.length)],
    ['Kroki TO-BE', String(toBeSteps.length)],
  ]

  return (
    <section className="report-section report-overview" aria-labelledby={summaryId}>
      <ReportSectionTitle
        number="01"
        title="Podsumowanie procesu"
        description="Najważniejsze informacje z całego przeprowadzonego procesu."
      />
      <div className="report-summary-grid" id={summaryId}>
        {items.map(([label, value]) => (
          <div className="report-summary-card" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function ReadOnlyStepList({ steps, findings = [], toBe = false }) {
  const findingsById = new Map(findings.map((finding) => [finding.id, finding]))

  return (
    <ol className="report-steps">
      {steps.map((step, index) => (
        <li key={step.id}>
          <span className="step-order">{index + 1}</span>
          <div>
            <div className="to-be-step-title">
              <strong>{step.name}</strong>
              {toBe && (
                <span className={`step-type type-${step.stepType.toLowerCase().replace(' ', '-')}`}>
                  {step.stepType}
                </span>
              )}
              {toBe && step.automatable === 'Tak' && (
                <span className="automation-badge">⚙ Możliwa automatyzacja</span>
              )}
            </div>
            {step.description && <p>{step.description}</p>}
            <div className="report-step-details">
              {step.owner && <span><small>Rola</small>{step.owner}</span>}
              {step.system && <span><small>Narzędzie</small>{step.system}</span>}
              {step.result && <span><small>Rezultat</small>{step.result}</span>}
              {toBe && getLinkedToBeFindings(step, findingsById).map(({ id, name }) => (
                <span key={id}><small>Powiązane usprawnienie</small>{name}</span>
              ))}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function AsIsReport({ startMethod, description, steps }) {
  return (
    <section className="report-section">
      <ReportSectionTitle
        number="02"
        title="Proces AS-IS"
        description="Obecny przebieg procesu przed zaprojektowaniem usprawnień."
      />
      {startMethod === 'steps' ? (
        <ReadOnlyStepList steps={steps} />
      ) : (
        <div className="report-description">
          <small>Pełny opis procesu</small>
          <p>{description}</p>
        </div>
      )}
    </section>
  )
}

function AnalysisReport({ findings, asIsSteps, startMethod }) {
  const location = (finding) => {
    if (!finding.location) return 'Nie wskazano'
    if (startMethod !== 'steps') return finding.location
    const index = asIsSteps.findIndex((step) => step.id === finding.location)
    return index >= 0 ? `${index + 1}. ${asIsSteps[index].name}` : 'Krok niedostępny'
  }

  return (
    <section className="report-section">
      <ReportSectionTitle
        number="03"
        title="Najważniejsze ustalenia z analizy"
        description="Problemy, ryzyka i możliwości zidentyfikowane w procesie AS-IS."
      />
      <div className="report-findings">
        {findings.map((finding, index) => (
          <article
            className={[
              'report-finding',
              finding.impactLevel === 'Wysoki' ? 'high-impact' : '',
              finding.category === 'Miejsce do automatyzacji' ? 'automation-finding' : '',
            ].filter(Boolean).join(' ')}
            key={finding.id}
          >
            <div className="finding-card-header">
              <span className="finding-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <span className="category-badge">{finding.category}</span>
                <h3>{finding.name}</h3>
              </div>
              <span className={`impact-badge impact-${finding.impactLevel.toLowerCase()}`}>
                {finding.impactLevel} wpływ
              </span>
            </div>
            <div className="finding-location"><strong>Gdzie:</strong> {location(finding)}</div>
            <div className="finding-details">
              {[
                ['Opis', finding.situation],
                ['Możliwa przyczyna', finding.cause],
                ['Wpływ na proces', finding.processImpact],
                ['Pomysł usprawnienia', finding.improvement],
              ].filter(([, value]) => value).map(([label, value]) => (
                <div key={label}><small>{label}</small><p>{value}</p></div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ToBeReport({ assumptions, steps, findings }) {
  const assumptionItems = [
    ['Cel projektowanej zmiany', assumptions.changeGoal],
    ['Oczekiwany rezultat', assumptions.expectedResult],
    ['Ograniczenia lub warunki', assumptions.constraints],
    ['Mierniki sukcesu', assumptions.successMeasures],
  ]

  return (
    <section className="report-section">
      <ReportSectionTitle
        number="04"
        title="Proces TO-BE"
        description="Docelowy przebieg procesu wraz z przyjętymi założeniami."
      />
      <div className="report-assumptions">
        {assumptionItems.map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <p>{value || 'Nie określono'}</p>
          </div>
        ))}
      </div>
      <ReadOnlyStepList steps={steps} findings={findings} toBe />
    </section>
  )
}

function ProcessComparison({ startMethod, asIsSteps, toBeSteps, stepComparison, selectedCount }) {
  const items = [
    [
      'Kroki AS-IS',
      startMethod === 'steps'
        ? asIsSteps.length
        : 'Nie dotyczy — proces AS-IS opisano tekstowo',
    ],
    ['Kroki TO-BE', toBeSteps.length],
    ['Nowe kroki', toBeSteps.filter((step) => step.stepType === 'Nowy').length],
    ['Zmienione kroki', toBeSteps.filter((step) => step.stepType === 'Zmieniony').length],
    ['Bez zmian', toBeSteps.filter((step) => step.stepType === 'Bez zmian').length],
    ['Możliwe do automatyzacji', toBeSteps.filter((step) => step.automatable === 'Tak').length],
    ['Uwzględnione ustalenia', selectedCount],
  ]

  return (
    <section className="report-section">
      <ReportSectionTitle
        number="05"
        title="Porównanie AS-IS i TO-BE"
        description="Automatyczne zestawienie struktury procesu przed i po zmianie."
      />
      <div className="comparison-grid">
        {items.map(([label, value]) => (
          <div key={label}><strong>{value}</strong><small>{label}</small></div>
        ))}
      </div>
      {stepComparison && <>
        <p>Porównanie nazw, odpowiedzialności i systemów opiera się na powiązaniach zachowanych przy kopiowaniu kroków.</p>
        <div className="recommendation-grid">
          <article>
            <h3>Zmiany w powiązanych krokach</h3>
            {stepComparison.changed.length ? <ul>{stepComparison.changed.map(({ id, name, differences }) => (
              <li key={id}><strong>{name}</strong>
                <ul>{differences.map(({ field, label, before, after }) => (
                  <li key={field}>{label}: {before || 'nie określono'} → {after || 'nie określono'}</li>
                ))}</ul>
              </li>
            ))}</ul> : <p>Brak zmian w porównywanych polach.</p>}
          </article>
          <article>
            <h3>Kroki TO-BE bez powiązania z AS-IS</h3>
            {stepComparison.unmatchedToBe.length ? <ul>{stepComparison.unmatchedToBe.map(({ id, name }) => (
              <li key={id}>{name}</li>
            ))}</ul> : <p>Wszystkie kroki TO-BE mają powiązanie.</p>}
          </article>
          <article>
            <h3>Kroki AS-IS bez powiązania z TO-BE</h3>
            {stepComparison.unmatchedAsIs.length ? <ul>{stepComparison.unmatchedAsIs.map(({ id, name }) => (
              <li key={id}>{name}</li>
            ))}</ul> : <p>Wszystkie kroki AS-IS mają powiązanie.</p>}
          </article>
        </div>
      </>}
    </section>
  )
}

function ProcessMapNode({ data }) {
  const isBoundary = data.kind === 'start' || data.kind === 'end'
  return (
    <div
      className={[
        'process-map-node',
        `map-node-${data.kind}`,
        data.stepType
          ? `map-type-${data.stepType.toLowerCase().replace(' ', '-')}`
          : '',
        data.automatable ? 'map-automatable' : '',
      ].filter(Boolean).join(' ')}
    >
      {data.kind !== 'start' && (
        <Handle type="target" position={Position.Left} isConnectable={false} />
      )}
      <div className="map-node-heading">
        <span>{isBoundary ? (data.kind === 'start' ? 'Start' : 'Koniec') : `Krok ${data.number}`}</span>
        {data.automatable && <em>⚙ Automatyzacja</em>}
      </div>
      <strong>{data.title}</strong>
      {!isBoundary && (
        <div className="map-node-details">
          {data.owner && <span><small>Rola</small>{data.owner}</span>}
          {data.system && <span><small>Narzędzie</small>{data.system}</span>}
          {data.result && <span><small>Rezultat</small>{data.result}</span>}
        </div>
      )}
      {data.flags?.length > 0 && (
        <div className="map-node-flags">
          {data.flags.map((flag) => <span key={flag}>{flag}</span>)}
        </div>
      )}
      {data.kind !== 'end' && (
        <Handle type="source" position={Position.Right} isConnectable={false} />
      )}
    </div>
  )
}

const processMapNodeTypes = { processNode: ProcessMapNode }

function createProcessFlow(steps, scope, variant, findings) {
  const nodeGap = 280
  const startId = `${variant}-start`
  const endId = `${variant}-end`
  const startTitle = scope.processStart?.trim() || 'Początek procesu'
  const endTitle = scope.processEnd?.trim() || 'Koniec procesu'
  const nodes = [
    {
      id: startId,
      type: 'processNode',
      position: { x: 0, y: 120 },
      data: { kind: 'start', title: startTitle },
      connectable: false,
      deletable: false,
    },
    ...steps.map((step, index) => {
      const linkedFindings =
        variant === 'as-is'
          ? findings.filter((finding) => finding.location === step.id)
          : []
      return {
        id: `${variant}-step-${step.id}`,
        type: 'processNode',
        position: { x: (index + 1) * nodeGap, y: 92 },
        data: {
          kind: 'step',
          number: index + 1,
          title: step.name,
          owner: step.owner,
          system: step.system,
          result: step.result,
          stepType: variant === 'to-be' ? step.stepType : null,
          automatable:
            variant === 'to-be'
              ? step.automatable === 'Tak'
              : linkedFindings.some(
                  (finding) => finding.category === 'Miejsce do automatyzacji',
                ),
          flags:
            variant === 'as-is'
              ? [...new Set(linkedFindings.map((finding) => finding.category))]
              : [],
        },
        connectable: false,
        deletable: false,
      }
    }),
    {
      id: endId,
      type: 'processNode',
      position: { x: (steps.length + 1) * nodeGap, y: 120 },
      data: { kind: 'end', title: endTitle },
      connectable: false,
      deletable: false,
    },
  ]
  const orderedIds = [startId, ...steps.map((step) => `${variant}-step-${step.id}`), endId]
  const edges = orderedIds.slice(0, -1).map((source, index) => ({
    id: `${variant}-edge-${index}`,
    source,
    target: orderedIds[index + 1],
    markerEnd: { type: MarkerType.ArrowClosed, color: '#7164bd' },
    style: { stroke: '#8f86c8', strokeWidth: 1.6 },
    selectable: false,
    focusable: false,
    deletable: false,
  }))
  for (const connection of getProcessConnections(steps)) {
    edges.push({
      id: `extra-${connection.sourceId}-${connection.index}`,
      source: `${variant}-step-${connection.sourceId}`,
      target: `${variant}-step-${connection.targetId}`,
      label: connection.label,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#b07824' },
      style: { stroke: '#b07824', strokeWidth: 2, strokeDasharray: '6 4' },
      labelBgStyle: { fill: '#fff8e8', fillOpacity: 1 },
      selectable: false, focusable: false, deletable: false,
    })
  }
  return { nodes, edges }
}

function ProcessFlowCanvas({ steps, scope, variant, findings }) {
  const flow = createProcessFlow(steps, scope, variant, findings)
  const [nodes, , onNodesChange] = useNodesState(flow.nodes)

  return (
    <div className="process-flow-canvas" aria-label={`Interaktywna mapa ${variant === 'to-be' ? 'TO-BE' : 'AS-IS'}`}>
      <ReactFlow
        nodes={nodes}
        edges={flow.edges}
        nodeTypes={processMapNodeTypes}
        onNodesChange={onNodesChange}
        nodesConnectable={false}
        nodesDraggable
        edgesFocusable={false}
        edgesReconnectable={false}
        connectOnClick={false}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1.05 }}
        minZoom={0.25}
        maxZoom={1.6}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1.2}
          color="#d3d0e5"
          bgColor="#fafafe"
        />
        <Controls
          showInteractive={false}
          fitViewOptions={{ padding: 0.18, maxZoom: 1.05 }}
          aria-label="Kontrolki mapy procesu"
        />
      </ReactFlow>
    </div>
  )
}

function ProcessMapSection({ scope, startMethod, asIsSteps, toBeSteps, findings, bpmnModels, exportStem }) {
  const [mapVariant, setMapVariant] = useState('to-be')
  const selectedSteps = mapVariant === 'to-be' ? toBeSteps : asIsSteps
  const isTextAsIs = mapVariant === 'as-is' && startMethod !== 'steps'
  const mapKey = `${mapVariant}-${selectedSteps.map((step) => step.id).join('-')}`

  return (
    <section className="report-section process-map-section">
      <ReportSectionTitle
        number="06"
        title="Interaktywna mapa procesu"
        description="Przesuwaj węzły, przybliżaj, oddalaj i dopasuj cały proces do widoku."
      />
      <div className="map-switch" role="group" aria-label="Wybierz mapę procesu">
        <button
          type="button"
          className={mapVariant === 'as-is' ? 'active' : ''}
          onClick={() => setMapVariant('as-is')}
          aria-pressed={mapVariant === 'as-is'}
        >
          Mapa AS-IS
        </button>
        <button
          type="button"
          className={mapVariant === 'to-be' ? 'active' : ''}
          onClick={() => setMapVariant('to-be')}
          aria-pressed={mapVariant === 'to-be'}
        >
          Mapa TO-BE
        </button>
      </div>

      {!isTextAsIs && bpmnModels && (
        <BpmnExport key={mapVariant} {...bpmnModels[mapVariant]} scope={scope} variant={mapVariant} saved readOnly exportStem={exportStem} />
      )}
      {isTextAsIs ? (
        <div className="map-empty-message">
          <span aria-hidden="true">i</span>
          <p>
            Mapa AS-IS nie jest dostępna, ponieważ proces został opisany tekstowo.
            Utworzenie mapy będzie możliwe po przekształceniu opisu w listę kroków.
          </p>
        </div>
      ) : selectedSteps.length === 0 ? (
        <div className="map-empty-message">
          <span aria-hidden="true">!</span>
          <p>Brak kroków potrzebnych do utworzenia wybranej mapy procesu.</p>
        </div>
      ) : (
        <>
          {getProcessConnections(selectedSteps).length > 0 && <p>Linia ciągła pokazuje kolejność kroków, a przerywana — dodane przejście.</p>}
          {mapVariant === 'to-be' && (
            <div className="map-legend" aria-label="Legenda mapy TO-BE">
              <span className="legend-new">Nowy</span>
              <span className="legend-changed">Zmieniony</span>
              <span className="legend-unchanged">Bez zmian</span>
              <span className="legend-auto">⚙ Możliwa automatyzacja</span>
              <span className="legend-boundary">Początek i koniec procesu</span>
            </div>
          )}
          <ProcessFlowCanvas
            key={mapKey}
            steps={selectedSteps}
            scope={scope}
            variant={mapVariant}
            findings={findings}
          />
        </>
      )}
    </section>
  )
}

function StakeholdersSection({
  stakeholders,
  draft,
  error,
  editingId,
  onChange,
  onAdd,
  onEdit,
  onDelete,
  onCancel,
  readOnly,
}) {
  return (
    <section className="report-section stakeholder-section">
      <ReportSectionTitle
        number="07"
        title="Interesariusze procesu"
        description="Osoby, role i zespoły zaangażowane w realizację oraz wynik procesu."
      />
      {!readOnly && <div className="finding-form-panel stakeholder-form">
        <div className="form-grid">
          <FormField
            id="stakeholderName"
            label="Nazwa osoby, roli lub zespołu"
            value={draft.name}
            onChange={onChange}
            error={error}
            required
            placeholder="np. Kierownik sprzedaży"
          />
          <SelectField id="stakeholderType" label="Typ" value={draft.type} onChange={onChange} options={stakeholderTypes} placeholder="" />
          <SelectField id="stakeholderInfluence" label="Wpływ na proces" value={draft.influence} onChange={onChange} options={impactLevels} placeholder="" />
          <SelectField id="stakeholderInterest" label="Zainteresowanie procesem" value={draft.interest} onChange={onChange} options={['Niskie', 'Średnie', 'Wysokie']} placeholder="" />
          <FormField id="stakeholderExpectations" label="Oczekiwania lub potrzeby" value={draft.expectations} onChange={onChange} placeholder="Czego potrzebuje ten interesariusz?" multiline />
          <FormField id="stakeholderEngagement" label="Sposób zaangażowania lub komunikacji" value={draft.engagement} onChange={onChange} placeholder="Jak i kiedy należy go angażować?" multiline />
        </div>
        <div className="step-form-actions">
          {editingId && <button className="cancel-edit-button" type="button" onClick={onCancel}>Anuluj edycję</button>}
          <button className="add-step-button" type="button" onClick={onAdd}>
            <span aria-hidden="true">{editingId ? '✓' : '+'}</span>
            {editingId ? 'Zapisz zmiany' : 'Dodaj interesariusza'}
          </button>
        </div>
      </div>}
      <div className="stakeholder-list">
        {stakeholders.map((item) => (
          <article key={item.id}>
            <span className="stakeholder-avatar" aria-hidden="true">{item.name.charAt(0).toUpperCase()}</span>
            <div>
              <span className="category-badge">{item.type}</span>
              <h3>{item.name}</h3>
              <div className="stakeholder-levels">
                <span>Wpływ: {item.influence}</span>
                <span>Zainteresowanie: {item.interest}</span>
              </div>
              {item.expectations && <p><strong>Oczekiwania:</strong> {item.expectations}</p>}
              {item.engagement && <p><strong>Zaangażowanie:</strong> {item.engagement}</p>}
            </div>
            {!readOnly && <div className="finding-actions">
              <button type="button" onClick={() => onEdit(item)}>✎ Edytuj</button>
              <button className="delete-finding" type="button" onClick={() => onDelete(item.id)}>× Usuń</button>
            </div>}
          </article>
        ))}
      </div>
    </section>
  )
}

function RaciSection({ steps, stakeholders, raci, errors, onChange, readOnly }) {
  const options = [
    ['', '—'],
    ['R', 'R'],
    ['A', 'A'],
    ['RA', 'R/A'],
    ['C', 'C'],
    ['I', 'I'],
  ]

  return (
    <section className="report-section raci-section">
      <ReportSectionTitle
        number="08"
        title="Macierz RACI dla procesu TO-BE"
        description="Przypisz odpowiedzialność dla każdego kroku procesu docelowego."
      />
      <div className="raci-legend">
        <span className="raci-r"><strong>R</strong> wykonuje zadanie</span>
        <span className="raci-a"><strong>A</strong> ostatecznie odpowiada za rezultat</span>
        <span className="raci-ra"><strong>R/A</strong> wykonuje zadanie i odpowiada za rezultat</span>
        <span className="raci-c"><strong>C</strong> udziela konsultacji</span>
        <span className="raci-i"><strong>I</strong> otrzymuje informację</span>
      </div>
      {stakeholders.length === 0 ? (
        <div className="empty-steps"><strong>Dodaj interesariusza, aby uzupełnić macierz RACI.</strong></div>
      ) : (
        <div className="raci-scroll">
          <table className="raci-table">
            <thead>
              <tr>
                <th>Krok TO-BE</th>
                {stakeholders.map((item) => <th key={item.id}>{item.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {steps.map((step, index) => (
                <Fragment key={step.id}>
                  <tr id={`raci-step-${step.id}`} tabIndex={-1}>
                    <th><span>{index + 1}</span>{step.name}</th>
                    {stakeholders.map((item) => {
                      const value = raci[step.id]?.[item.id] ?? ''
                      return (
                        <td key={item.id}>
                          <select
                            className={`raci-select raci-${value.toLowerCase()}`}
                            value={value}
                            disabled={readOnly}
                            onChange={(event) => onChange(step.id, item.id, event.target.value)}
                            aria-label={`${step.name}: ${item.name}`}
                            aria-describedby={errors[step.id]?.length ? `raci-errors-${step.id}` : undefined}
                          >
                            {options.map(([optionValue, label]) => <option value={optionValue} key={optionValue || 'none'}>{label}</option>)}
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                  {errors[step.id]?.length > 0 && (
                    <tr className="raci-error-row">
                      <td id={`raci-errors-${step.id}`} colSpan={stakeholders.length + 1}>
                        {errors[step.id].map((message) => <span key={message}>! {message}</span>)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function PrintProcessMap({ title, steps, scope, variant, findings, unavailable }) {
  if (unavailable) {
    return (
      <div className="print-map-block">
        <h3>{title}</h3>
        <p className="print-map-message">
          Mapa AS-IS nie jest dostępna, ponieważ proces został opisany tekstowo.
          Utworzenie mapy będzie możliwe po przekształceniu opisu w listę kroków.
        </p>
      </div>
    )
  }

  if (steps.length === 0) {
    return (
      <div className="print-map-block">
        <h3>{title}</h3>
        <p className="print-map-message">
          Brak kroków potrzebnych do utworzenia mapy procesu.
        </p>
      </div>
    )
  }

  const mapItems = [
    {
      id: `${variant}-print-start`,
      kind: 'start',
      label: 'Początek procesu',
      name: scope.processStart?.trim() || 'Początek procesu',
    },
    ...steps.map((step, index) => {
      const linkedFindings =
        variant === 'as-is'
          ? findings.filter((finding) => finding.location === step.id)
          : []
      return {
        ...step,
        kind: 'step',
        label: `Krok ${index + 1}`,
        name: step.name,
        automatable:
          variant === 'to-be'
            ? step.automatable === 'Tak'
            : linkedFindings.some(
                (finding) => finding.category === 'Miejsce do automatyzacji',
              ),
        flags:
          variant === 'as-is'
            ? [...new Set(linkedFindings.map((finding) => finding.category))]
            : [],
      }
    }),
    {
      id: `${variant}-print-end`,
      kind: 'end',
      label: 'Koniec procesu',
      name: scope.processEnd?.trim() || 'Koniec procesu',
    },
  ]

  return (
    <div className="print-map-block">
      <h3>{title}</h3>
      {variant === 'to-be' && (
        <div className="map-legend print-map-legend">
          <span className="legend-new">Nowy</span>
          <span className="legend-changed">Zmieniony</span>
          <span className="legend-unchanged">Bez zmian</span>
          <span className="legend-auto">⚙ Możliwa automatyzacja</span>
          <span className="legend-boundary">Początek i koniec procesu</span>
        </div>
      )}
      <div className="print-process-map">
        {mapItems.map((item, index) => (
          <Fragment key={item.id}>
            <article
              className={[
                'print-map-node',
                `print-map-${item.kind}`,
                variant === 'to-be' && item.stepType
                  ? `print-map-${item.stepType.toLowerCase().replace(' ', '-')}`
                  : '',
                item.automatable ? 'print-map-automatable' : '',
              ].filter(Boolean).join(' ')}
            >
              <div className="print-map-heading">
                <span>{item.label}</span>
                {item.automatable && <em>⚙ Automatyzacja</em>}
              </div>
              <strong>{item.name}</strong>
              {item.kind === 'step' && (
                <div className="print-map-details">
                  {item.owner && <span><small>Rola</small>{item.owner}</span>}
                  {item.system && <span><small>Narzędzie</small>{item.system}</span>}
                  {item.result && <span><small>Rezultat</small>{item.result}</span>}
                </div>
              )}
              {item.flags?.length > 0 && (
                <div className="map-node-flags">
                  {item.flags.map((flag) => <span key={flag}>{flag}</span>)}
                </div>
              )}
            </article>
            {index < mapItems.length - 1 && (
              <div className="print-map-arrow" aria-hidden="true">↓</div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function PrintStakeholders({ stakeholders }) {
  return (
    <section className="report-section print-stakeholder-section">
      <ReportSectionTitle
        number="07"
        title="Interesariusze procesu"
        description="Osoby, role i zespoły uwzględnione w raporcie."
      />
      <div className="print-stakeholders">
        {stakeholders.map((item) => (
          <article key={item.id}>
            <span className="category-badge">{item.type}</span>
            <h3>{item.name}</h3>
            <p><strong>Wpływ:</strong> {item.influence} · <strong>Zainteresowanie:</strong> {item.interest}</p>
            {item.expectations && <p><strong>Oczekiwania:</strong> {item.expectations}</p>}
            {item.engagement && <p><strong>Zaangażowanie:</strong> {item.engagement}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}

function PrintRaci({ steps, stakeholders, raci }) {
  const assignedNames = (stepId, role) =>
    stakeholders
      .filter((item) => raci[stepId]?.[item.id] === role)
      .map((item) => item.name)

  return (
    <section className="report-section">
      <ReportSectionTitle
        number="08"
        title="Przypisania RACI"
        description="Układ według kroków procesu TO-BE, przygotowany do wydruku."
      />
      <div className="raci-legend">
        <span className="raci-r"><strong>R</strong> wykonuje zadanie</span>
        <span className="raci-a"><strong>A</strong> ostatecznie odpowiada za rezultat</span>
        <span className="raci-ra"><strong>R/A</strong> wykonuje zadanie i odpowiada za rezultat</span>
        <span className="raci-c"><strong>C</strong> udziela konsultacji</span>
        <span className="raci-i"><strong>I</strong> otrzymuje informację</span>
      </div>
      <div className="print-raci-list">
        {steps.map((step, index) => {
          const assignments = ['RA', 'R', 'A', 'C', 'I']
            .map((role) => [role, assignedNames(step.id, role)])
            .filter(([, names]) => names.length > 0)

          return (
            <article key={step.id}>
              <h3><span>{index + 1}</span>{step.name}</h3>
              <dl>
                {assignments.map(([role, names]) => (
                  <div className={`print-raci-${role.toLowerCase()}`} key={role}>
                    <dt>{role === 'RA' ? 'R/A' : role}</dt>
                    <dd>{names.join(', ')}</dd>
                  </div>
                ))}
              </dl>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PrintReport({
  scope,
  startMethod,
  asIsDescription,
  asIsSteps,
  externalSteps,
  toBeExternalSteps,
  externalLinks,
  toBeExternalLinks,
  printBpmn,
  findings,
  toBeAssumptions,
  selectedFindingIds,
  toBeSteps,
  stepComparison,
  stakeholders,
  raci,
  workshopQuestions,
  generatedAt,
  completedVersion,
}) {
  const formattedDate = new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(generatedAt ?? new Date())

  return (
    <div className="print-report">
      <header className="print-report-header">
        <span>Architekt Procesów</span>
        <h1>Raport procesu</h1>
        <p>{scope.processName}</p>
        {completedVersion !== undefined && <p>Wersja procesu {completedVersion}</p>}
        <time dateTime={(generatedAt ?? new Date()).toISOString()}>
          Data wygenerowania: {formattedDate}
        </time>
      </header>
      <ProcessReportSummary
        scope={scope}
        startMethod={startMethod}
        asIsSteps={asIsSteps}
        findings={findings}
        toBeSteps={toBeSteps}
        summaryId="print-report-summary-title"
      />
      <AsIsReport startMethod={startMethod} description={asIsDescription} steps={asIsSteps} />
      <AnalysisReport findings={findings} asIsSteps={asIsSteps} startMethod={startMethod} />
      <ToBeReport assumptions={toBeAssumptions} steps={toBeSteps} findings={findings} />
      <ProcessComparison
        startMethod={startMethod}
        asIsSteps={asIsSteps}
        toBeSteps={toBeSteps}
        stepComparison={stepComparison}
        selectedCount={selectedFindingIds.length}
      />
      <section className="report-section print-maps-section">
        <ReportSectionTitle
          number="06"
          title="Mapy procesu"
          description="Statyczny przebieg procesów AS-IS i TO-BE."
        />
        {startMethod === 'steps' && <PrintBpmnDetails steps={asIsSteps} externalSteps={externalSteps} externalLinks={externalLinks} svg={printBpmn.svg} error={printBpmn.error} />}
        <PrintProcessMap
          title="Uproszczony przebieg podstawowy AS-IS"
          steps={asIsSteps}
          scope={scope}
          variant="as-is"
          findings={findings}
          unavailable={startMethod !== 'steps'}
        />
        <PrintBpmnDetails steps={toBeSteps} externalSteps={toBeExternalSteps} externalLinks={toBeExternalLinks} variant="TO-BE" svg={printBpmn.toBeSvg} error={printBpmn.toBeError} />
        <PrintProcessMap
          title="Uproszczony przebieg TO-BE"
          steps={toBeSteps}
          scope={scope}
          variant="to-be"
          findings={findings}
        />
      </section>
      <PrintStakeholders stakeholders={stakeholders} />
      <PrintRaci steps={toBeSteps} stakeholders={stakeholders} raci={raci} />
      <Recommendations
        findings={findings}
        toBeSteps={toBeSteps}
        selectedFindingIds={selectedFindingIds}
      />
      {workshopQuestions.length > 0 && (
        <section className="report-section report-workshop-questions">
          <ReportSectionTitle number="10" title="Otwarte pytania po warsztacie" />
          <ol>
            {workshopQuestions.map((question) => (
              <li key={question.id}><strong>{question.text}</strong><WorkshopQuestionDetails question={question} /></li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

function Recommendations({ findings, toBeSteps, selectedFindingIds }) {
  const stepsByFinding = getToBeStepsByFinding(toBeSteps)
  const selectedIds = new Set(selectedFindingIds)
  const missingSteps = findings.filter(({ id }) => selectedIds.has(id) && !stepsByFinding.has(id))
  const groups = [
    ['Kroki możliwe do automatyzacji', toBeSteps.filter((step) => step.automatable === 'Tak').map((step) => step.name), 'Nie wskazano kroków możliwych do automatyzacji'],
    ['Ustalenia o wysokim wpływie', findings.filter((item) => item.impactLevel === 'Wysoki').map((item) => item.name), 'Nie zidentyfikowano ustaleń o wysokim wpływie'],
    ['Wąskie gardła', findings.filter((item) => item.category === 'Wąskie gardło').map((item) => item.name), 'Nie zidentyfikowano wąskich gardeł'],
    ['Ryzyka', findings.filter((item) => item.category === 'Ryzyko lub możliwość błędu').map((item) => item.name), 'Nie zidentyfikowano ryzyk'],
    ['Niejasne odpowiedzialności', findings.filter((item) => item.category === 'Niejasna odpowiedzialność').map((item) => item.name), 'Brak ustaleń analitycznych w tej kategorii'],
    ['Wybrane ustalenia bez powiązanego kroku TO-BE', missingSteps.map(({ name }) => name), 'Każde wybrane ustalenie ma powiązany krok TO-BE'],
    ['Ustalenia nieuwzględnione w TO-BE', findings.filter((item) => !selectedIds.has(item.id)).map((item) => item.name), 'Wszystkie ustalenia uwzględniono w TO-BE'],
  ]

  return (
    <section className="report-section recommendations">
      <ReportSectionTitle number="09" title="Rekomendacje" description="Automatyczne zestawienie wynikające z zapisanych danych procesu." />
      <div className="recommendation-grid">
        {groups.map(([title, items, empty]) => (
          <article key={title}>
            <h3>{title}</h3>
            {items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{empty}</p>}
          </article>
        ))}
      </div>
    </section>
  )
}

function loadReportQuestions(processId) {
  if (!processId) return []
  try {
    const { transcript } = loadWorkshop(localStorage, processId)
    const { review } = loadWorkshopReview(localStorage, processId, transcript)
    return (review?.questions ?? []).flatMap(({ text, reviewed, answerConfirmed, assignee, dueDate }, index) => {
      if (reviewed !== true || answerConfirmed) return []
      const question = { text: text.trim(), assignee: assignee?.trim() ?? '', dueDate: dueDate ?? '' }
      return [{ ...question, id: JSON.stringify([index, question]) }]
    })
  } catch {
    return []
  }
}

function WorkshopQuestionDetails({ question }) {
  const dueDate = question.dueDate.split('-').reverse().join('.')
  return <p>Osoba lub zespół: {question.assignee || 'do ustalenia'} · Termin: {dueDate || 'do ustalenia'}</p>
}

function ReportScreen({
  processId,
  completed,
  completedVersion,
  scope,
  startMethod,
  asIsDescription,
  asIsSteps,
  externalSteps,
  toBeExternalSteps,
  externalLinks,
  toBeExternalLinks,
  printBpmn,
  printPreparing,
  findings,
  toBeAssumptions,
  selectedFindingIds,
  toBeSteps: modeledSteps,
  stakeholders,
  stakeholderDraft,
  stakeholderError,
  editingStakeholderId,
  raci,
  raciErrors,
  reportError,
  saved,
  saveError,
  onStakeholderChange,
  onAddStakeholder,
  onEditStakeholder,
  onDeleteStakeholder,
  onCancelStakeholder,
  onRaciChange,
  onBack,
  onSave,
  onFinish,
  onExport,
  printGeneratedAt,
}) {
  const stepComparison = startMethod === 'steps' ? compareProcessSteps(asIsSteps, modeledSteps) : null
  const toBeSteps = withDetectedStepChanges(modeledSteps, stepComparison)
  const [workshopQuestions, setWorkshopQuestions] = useState(() => loadReportQuestions(processId))
  const [selectedQuestions, setSelectedQuestions] = useState([])
  const [questionError, setQuestionError] = useState('')
  const questionsForPrint = workshopQuestions.filter((question) => selectedQuestions.includes(question.id))

  const handleExport = () => {
    if (selectedQuestions.length > 0) {
      const currentQuestions = loadReportQuestions(processId)
      if (!selectedQuestions.every((id) => currentQuestions.some((question) => question.id === id))) {
        setWorkshopQuestions(currentQuestions)
        setSelectedQuestions([])
        setQuestionError('Ustalenia warsztatowe się zmieniły. Sprawdź pytania przed eksportem.')
        return
      }
    }
    setQuestionError('')
    onExport()
  }

  return (
    <section className="workspace report-workspace" aria-labelledby="report-title">
      <div className="analysis-intro">
        <span className="eyebrow"><CompassIcon />Etap 5 · Raport procesu</span>
        <h1 id="report-title">Podsumuj proces i odpowiedzialności</h1>
        <p>Przejrzyj pełny wynik pracy, uzupełnij interesariuszy i przypisz role RACI dla procesu docelowego.</p>
      </div>
      <ProcessReportSummary scope={scope} startMethod={startMethod} asIsSteps={asIsSteps} findings={findings} toBeSteps={toBeSteps} />
      <AsIsReport startMethod={startMethod} description={asIsDescription} steps={asIsSteps} />
      <AnalysisReport findings={findings} asIsSteps={asIsSteps} startMethod={startMethod} />
      <ToBeReport assumptions={toBeAssumptions} steps={toBeSteps} findings={findings} />
      <ProcessComparison startMethod={startMethod} asIsSteps={asIsSteps} toBeSteps={toBeSteps} stepComparison={stepComparison} selectedCount={selectedFindingIds.length} />
      <ProcessMapSection
        scope={scope}
        startMethod={startMethod}
        asIsSteps={asIsSteps}
        toBeSteps={toBeSteps}
        findings={findings}
        exportStem={completed ? completedProcessExportStem(scope.processName, completedVersion) : undefined}
        bpmnModels={completed ? {
          'as-is': { steps: asIsSteps, externalSteps, externalLinks },
          'to-be': { steps: modeledSteps, externalSteps: toBeExternalSteps, externalLinks: toBeExternalLinks },
        } : undefined}
      />
      <StakeholdersSection
        stakeholders={stakeholders}
        draft={stakeholderDraft}
        error={stakeholderError}
        editingId={editingStakeholderId}
        onChange={onStakeholderChange}
        onAdd={onAddStakeholder}
        onEdit={onEditStakeholder}
        onDelete={onDeleteStakeholder}
        onCancel={onCancelStakeholder}
        readOnly={completed}
      />
      <RaciSection steps={toBeSteps} stakeholders={stakeholders} raci={raci} errors={raciErrors} onChange={onRaciChange} readOnly={completed} />
      <Recommendations findings={findings} toBeSteps={toBeSteps} selectedFindingIds={selectedFindingIds} />
      {(workshopQuestions.length > 0 || questionError) && (
        <section className="report-section report-workshop-questions">
          <ReportSectionTitle number="10" title="Otwarte pytania po warsztacie"
            description="Zaznacz pytania, które chcesz uwzględnić w PDF." />
          {questionError && <p role="alert">{questionError}</p>}
          <ul>
            {workshopQuestions.map((question) => (
              <li key={question.id}>
                <label>
                  <input type="checkbox" checked={selectedQuestions.includes(question.id)} disabled={printPreparing}
                    onChange={(event) => {
                      const { checked } = event.target
                      setSelectedQuestions((current) => checked
                        ? [...current, question.id]
                        : current.filter((id) => id !== question.id))
                    }} />
                  {question.text}
                </label>
                <WorkshopQuestionDetails question={question} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {reportError && <div className="save-message storage-error" role="alert"><span aria-hidden="true">!</span><div><strong>{reportError}</strong><small>Uzupełnij wymagane dane raportu.</small></div></div>}
      {saved && <div className="save-message success-message" role="status"><span aria-hidden="true">✓</span><div><strong>Raport procesu został zapisany</strong><small>Interesariusze i macierz RACI są zapisane lokalnie.</small></div></div>}
      {saveError && <div className="save-message storage-error" role="alert"><span aria-hidden="true">!</span><div><strong>Nie udało się zapisać raportu</strong><small>Sprawdź ustawienia przeglądarki i spróbuj ponownie.</small></div></div>}
      <p className="export-guidance">
        W oknie drukowania wybierz drukarkę „Zapisz jako PDF”.
      </p>
      <div className="form-actions">
        {!completed && <>
          <button className="back-button" type="button" onClick={onBack}><span aria-hidden="true">←</span>Wróć do TO-BE</button>
          <button className="save-button" type="button" onClick={onSave}>Zapisz raport<span aria-hidden="true">✓</span></button>
          {saved && <button className="back-button" type="button" onClick={onFinish}>Zakończ wersję</button>}
        </>}
        <button className="export-button" type="button" onClick={handleExport} disabled={printPreparing}>
          {printPreparing ? 'Przygotowuję PDF…' : 'Eksportuj do PDF'}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      <PrintReport
        scope={scope}
        startMethod={startMethod}
        asIsDescription={asIsDescription}
        asIsSteps={asIsSteps}
        externalSteps={externalSteps}
        toBeExternalSteps={toBeExternalSteps}
        externalLinks={externalLinks}
        toBeExternalLinks={toBeExternalLinks}
        printBpmn={printBpmn}
        findings={findings}
        toBeAssumptions={toBeAssumptions}
        selectedFindingIds={selectedFindingIds}
        toBeSteps={toBeSteps}
        stepComparison={stepComparison}
        stakeholders={stakeholders}
        raci={raci}
        workshopQuestions={questionsForPrint}
        generatedAt={printGeneratedAt}
        completedVersion={completedVersion}
      />
    </section>
  )
}
function ProcessesScreen({ processes, onOpen, onDelete, onCreateVersion, currentId, onBack }) {
  const series = new Map()
  for (const process of processes.filter((item) => item && typeof item === 'object')) {
    const key = process.seriesId ?? process.id
    if (!series.has(key)) series.set(key, [])
    series.get(key).push(process)
  }
  const groupedProcesses = [...series.values()].flat()
  const latestCompletedIds = new Set([...series.values()].flatMap((versions) => {
    const latest = versions.reduce((current, process) => process.status === 'completed'
      && (current === null || (process.version ?? 1) > (current.version ?? 1)) ? process : current, null)
    return latest ? [latest.id] : []
  }))
  return (
    <section className="processes-screen">
      <div className="processes-header">
        <div>
          <p className="eyebrow">Biblioteka procesów</p>
          <h2>Moje procesy</h2>
          <p>Zapisane procesy możesz ponownie otworzyć i kontynuować.</p>
          <p>Podczas usuwania pracuj w jednej karcie aplikacji. Usunięcie nie obejmuje wyeksportowanych plików ani kopii zapasowych.</p>
        </div>

        <button type="button" className="status-badge" onClick={onBack}>
          Wróć do procesu
        </button>
      </div>

      {groupedProcesses.length === 0 ? (
        <div className="processes-empty">
          <h3>Nie masz jeszcze zapisanych procesów</h3>
          <p>
            Pierwszy szkic pojawi się tutaj po zapisaniu zakresu procesu.
          </p>
        </div>
      ) : (
        <div className="processes-list">
          {groupedProcesses.map((process) => (
            <article className="process-card" key={process.id}>
              <div>
                <h3>{process.name}</h3>
                {process.status && <p>Wersja {process.version ?? 1} · {process.status === 'completed' ? 'Zakończona' : 'W toku'}</p>}
                {latestCompletedIds.has(process.id) && <small>Aktualna wersja</small>}
                <p>
                  Zapisano:{' '}
                  {new Date(process.savedAt).toLocaleString('pl-PL')}
                </p>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() => onOpen(process)}
              >
                Otwórz proces
              </button>
              {process.status === 'completed' && (
                <button type="button" className="back-button" onClick={() => onCreateVersion(process)}>Utwórz nową wersję</button>
              )}
              <button type="button" className="back-button" aria-label={`Usuń proces ${process.name}`} onClick={() => onDelete(process)}>
                Usuń proces
              </button>
              {isValidProcessId(process.id) && currentId?.toLowerCase() === process.id.toLowerCase() && <small>Otwarty proces: przed usunięciem rozpocznij lub otwórz inny.</small>}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function loadSavedProcesses() {
  try {
    const raw = localStorage.getItem(PROCESSES_STORAGE_KEY)
    if (raw === null) return { processes: [], error: '' }
    const savedProcesses = JSON.parse(raw)
    if (!Array.isArray(savedProcesses)) throw new Error('INVALID_LIBRARY')
    return { processes: savedProcesses, error: '' }
  } catch {
    return { processes: [], error: 'Nie można odczytać biblioteki procesów. Istniejący zapis nie został nadpisany. Wstrzymaj zapis do biblioteki i sprawdź dane.' }
  }
}

function readProcessSections() {
  return {
    scope: localStorage.getItem(STORAGE_KEY),
    asIs: localStorage.getItem(AS_IS_STORAGE_KEY),
    analysis: localStorage.getItem(ANALYSIS_STORAGE_KEY),
    toBe: localStorage.getItem(TO_BE_STORAGE_KEY),
    report: localStorage.getItem(REPORT_STORAGE_KEY),
  }
}

function createStorageBackup(storage, keys) {
  return keys.map((key) => {
    const value = storage.getItem(key)
    return { key, existed: value !== null, value }
  })
}

function restoreStorageBackup(storage, backup) {
  let rollbackFailed = false

  backup.forEach(({ key, existed, value }) => {
    try {
      if (existed) {
        storage.setItem(key, value)
      } else {
        storage.removeItem(key)
      }
    } catch {
      rollbackFailed = true
    }
  })

  return !rollbackFailed
}


function App() {
  const [libraryStorageUncertain, setLibraryStorageUncertain] = useState(false)
  const [libraryMessage, setLibraryMessage] = useState('')
  const workshopDirtyRef = useRef(false)
  const workshopRecordingRef = useRef(false)
  const [decisionDraftFlags, setDecisionDraftFlags] = useState({})
  const decisionDraftDirty = Object.values(decisionDraftFlags).some(Boolean)
  const onBpmnDraftChange = (id, dirty) => setDecisionDraftFlags((current) => ({ ...current, [id]: dirty }))
  useEffect(() => {
    if (!decisionDraftDirty) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [decisionDraftDirty])
  const canLeaveWorkshop = () => {
    if (workshopRecordingRef.current && !window.confirm('Opuścić warsztat? Nagranie dostępne tylko na tym ekranie zostanie utracone.')) return false
    if (!workshopDirtyRef.current && !decisionDraftDirty) return true
    if (!window.confirm('Transkrypcja, propozycja warsztatu albo ustawienia BPMN mają niezapisane zmiany. Czy na pewno chcesz opuścić ten ekran i je utracić?')) return false
    setDecisionDraftFlags({})
    return true
  }
  const [initialLibrary] = useState(loadSavedProcesses)
  const [savedProcesses, setSavedProcesses] = useState(initialLibrary.processes)
  const libraryRef = useRef(initialLibrary.processes)
  const updateLibrary = (processes) => {
    libraryRef.current = processes
    setSavedProcesses(processes)
  }
  const [processIdentityState, setProcessIdentityState] = useState(() => {
    try {
      return {
        id: loadCurrentProcessId(localStorage),
        error: '',
      }
    } catch {
      return {
        id: null,
        error: 'Nie udało się odczytać identyfikatora procesu.',
      }
    }
  })
  const [supabaseTest, setSupabaseTest] = useState({
    status: 'idle',
    count: null,
  })
  const [savedScope] = useState(loadSavedScope)
  const [savedAsIs] = useState(loadSavedAsIs)
  const [savedAnalysis] = useState(loadSavedAnalysis)
  const [savedToBe] = useState(loadSavedToBe)
  const [savedReport] = useState(loadSavedReport)
  const [initialDraft] = useState(() => initialLibrary.processes.find((process) =>
    isValidProcessId(process?.id) && process.id.toLowerCase() === processIdentityState.id?.toLowerCase())?.draft)
  const [screen, setScreen] = useState(() => {
    const draft = initialLibrary.processes.find((process) =>
      isValidProcessId(process?.id) && process.id.toLowerCase() === processIdentityState.id?.toLowerCase())
    try {
      const remembered = sessionStorage.getItem(SCREEN_STORAGE_KEY)
      if (remembered === 'processes') return remembered
      if (draft?.status !== 'completed' && PROCESS_SCREENS.includes(remembered)) return remembered
    } catch {
      // Resume from the locally saved process when the tab state is unavailable.
    }
    if (!processIdentityState.id || !savedScope.data.processName.trim()) return 'start'
    if (draft?.status === 'completed') return 'report'
    if (PROCESS_SCREENS.includes(draft?.lastScreen)) return draft.lastScreen
    if (savedReport.isSaved) return 'report'
    if (savedToBe.isSaved) return 'to-be'
    if (savedAnalysis.isSaved) return 'analysis'
    return 'as-is'
  })
  useEffect(() => {
    if (!['as-is', 'analysis', 'to-be', 'report'].includes(screen)) return
    try {
      sessionStorage.setItem('architekt-procesow-screen-to-open', screen)
    } catch {
      // The saved process sections remain available if session storage is unavailable.
    }
  }, [screen])
  const [screenBeforeProcesses, setScreenBeforeProcesses] = useState('start')
  const [startMethod, setStartMethod] = useState(savedScope.startMethod)
  const [workMode, setWorkMode] = useState(savedScope.workMode)
  const [formData, setFormData] = useState(initialDraft?.scope ?? savedScope.data)
  const [errors, setErrors] = useState({})
  const [scopeSaveError, setScopeSaveError] = useState(false)
  const [asIsDescription, setAsIsDescription] = useState(initialDraft?.asIs?.description ?? savedAsIs.description)
  const [steps, setSteps] = useState(initialDraft?.asIs?.steps ?? savedAsIs.steps)
  const [externalLinks, setExternalLinks] = useState(savedAsIs.externalLinks ?? [])
  const [externalSteps, setExternalSteps] = useState(savedAsIs.externalSteps || [])
  const [stepDraft, setStepDraft] = useState(initialDraft?.asIs?.form ?? emptyStep)
  const [editingStepId, setEditingStepId] = useState(initialDraft?.asIs?.editingId ?? null)
  const [descriptionError, setDescriptionError] = useState('')
  const [stepError, setStepError] = useState('')
  const [asIsError, setAsIsError] = useState('')
  const [asIsSaved, setAsIsSaved] = useState(!initialDraft?.asIs && savedAsIs.isSaved)
  const [asIsSaveError, setAsIsSaveError] = useState(false)
  const [findings, setFindings] = useState(initialDraft?.analysis?.findings ?? savedAnalysis.findings)
  const [findingDraft, setFindingDraft] = useState(initialDraft?.analysis?.form ?? emptyFinding)
  const [editingFindingId, setEditingFindingId] = useState(initialDraft?.analysis?.editingId ?? null)
  const [findingErrors, setFindingErrors] = useState({})
  const [analysisError, setAnalysisError] = useState('')
  const [analysisSaved, setAnalysisSaved] = useState(!initialDraft?.analysis && savedAnalysis.isSaved)
  const [analysisSaveError, setAnalysisSaveError] = useState(false)
  const [toBeAssumptions, setToBeAssumptions] = useState(initialDraft?.toBe?.assumptions ?? savedToBe.assumptions)
  const [selectedFindingIds, setSelectedFindingIds] = useState(
    (
      initialDraft?.toBe?.selectedFindingIds ?? savedToBe.selectedFindingIds ??
      savedAnalysis.findings.map((finding) => finding.id)
    ).filter((id) =>
      (initialDraft?.analysis?.findings ?? savedAnalysis.findings).some((finding) => finding.id === id),
    ),
  )
  const [toBeSteps, setToBeSteps] = useState(initialDraft?.toBe?.steps ?? savedToBe.steps)
  const [toBeExternalLinks, setToBeExternalLinks] = useState(initialDraft?.toBe?.externalLinks ?? savedToBe.externalLinks ?? [])
  const [toBeExternalSteps, setToBeExternalSteps] = useState(initialDraft?.toBe?.externalSteps ?? savedToBe.externalSteps ?? [])
  const [toBeStepDraft, setToBeStepDraft] = useState(initialDraft?.toBe?.form ?? emptyToBeStep)
  const [editingToBeStepId, setEditingToBeStepId] = useState(initialDraft?.toBe?.editingId ?? null)
  const [toBeAssumptionError, setToBeAssumptionError] = useState('')
  const [toBeStepError, setToBeStepError] = useState('')
  const [toBeError, setToBeError] = useState('')
  const [toBeSaved, setToBeSaved] = useState(!initialDraft?.toBe && savedToBe.isSaved)
  const [toBeSaveError, setToBeSaveError] = useState(false)
  const [copiedFromAsIs, setCopiedFromAsIs] = useState(initialDraft?.toBe?.copiedFromAsIs ?? savedToBe.copiedFromAsIs)
  const [copyMessage, setCopyMessage] = useState('')
  const [copyError, setCopyError] = useState('')
  const suggestedStakeholders = buildSuggestedStakeholders(
    savedScope.data,
    savedAsIs.steps,
    savedToBe.steps,
  )
  const [stakeholders, setStakeholders] = useState(
    initialDraft?.report?.stakeholders ?? (savedReport.initialized || savedReport.stakeholders.length > 0
      ? savedReport.stakeholders
      : suggestedStakeholders),
  )
  const [stakeholderDraft, setStakeholderDraft] = useState(initialDraft?.report?.form ?? emptyStakeholder)
  const [editingStakeholderId, setEditingStakeholderId] = useState(initialDraft?.report?.editingId ?? null)
  const [stakeholderError, setStakeholderError] = useState('')
  const [raci, setRaci] = useState(initialDraft?.report?.raci ?? savedReport.raci)
  const [raciErrors, setRaciErrors] = useState({})
  const [reportError, setReportError] = useState('')
  const [reportSaved, setReportSaved] = useState(!initialDraft?.report && savedReport.isSaved)
  const [reportSaveError, setReportSaveError] = useState(false)
  const [printGeneratedAt, setPrintGeneratedAt] = useState(null)
  const [printBpmn, setPrintBpmn] = useState({ svg: '', error: '' })
  const [printPreparing, setPrintPreparing] = useState(false)
  const printPreparingRef = useRef(false)
  const asIsFormPending = startMethod === 'steps' && hasPendingForm(stepDraft, emptyStep, editingStepId)
  const findingFormPending = hasPendingForm(findingDraft, emptyFinding, editingFindingId)
  const toBeFormPending = hasPendingForm(toBeStepDraft, emptyToBeStep, editingToBeStepId)
  const stakeholderFormPending = hasPendingForm(stakeholderDraft, emptyStakeholder, editingStakeholderId)
  const activeProcess = savedProcesses.find((process) => isValidProcessId(process?.id)
    && process.id.toLowerCase() === processIdentityState.id?.toLowerCase())
  const completed = activeProcess?.status === 'completed'

  const readCurrentLibrary = () => {
    const current = loadSavedProcesses()
    if (current.error || JSON.stringify(current.processes) !== JSON.stringify(libraryRef.current)) {
      throw new Error('LIBRARY_CHANGED')
    }
    return current.processes
  }

  const writeLibrary = (processes) => {
    localStorage.setItem(PROCESSES_STORAGE_KEY, JSON.stringify(processes))
    updateLibrary(processes)
  }

  const writeProcessSection = (key, value) => {
    readCurrentLibrary()
    assertActiveProcess()
    if (completed) throw new Error('PROCESS_CHANGED')
    localStorage.setItem(key, value)
  }

  const assertActiveProcess = () => {
    if (loadCurrentProcessId(localStorage)?.toLowerCase() !== processIdentityState.id?.toLowerCase()) {
      throw new Error('PROCESS_CHANGED')
    }
  }

  const changeWorkMode = (nextMode) => {
    try {
      const storedScope = JSON.parse(localStorage.getItem(STORAGE_KEY))
      writeProcessSection(STORAGE_KEY, JSON.stringify({ ...storedScope, workMode: nextMode }))
      setWorkMode(nextMode)
    } catch {
      setProcessIdentityState((current) => ({ ...current, error: 'Nie udało się zapisać trybu pracy.' }))
    }
  }

  const checkpointProcess = (processId, lastScreen, fields = {}) => {
    const current = readCurrentLibrary()
    const activeId = loadCurrentProcessId(localStorage)
    if (activeId?.toLowerCase() !== processId.toLowerCase()) throw new Error('LIBRARY_CHANGED')
    const existing = current.find((process) => isValidProcessId(process?.id) && process.id.toLowerCase() === processId.toLowerCase())
    if (existing?.status === 'completed') return existing
    const scope = localStorage.getItem(STORAGE_KEY)
    const name = JSON.parse(scope)?.data?.processName?.trim()
    if (!name) return null
    const snapshot = {
      ...buildProcessSnapshot({
        existingProcess: existing,
        id: processId,
        name,
        savedAt: new Date().toISOString(),
        lastScreen: PROCESS_SCREENS.includes(lastScreen) ? lastScreen : existing?.lastScreen ?? 'scope',
        sections: readProcessSections(),
      }),
      status: existing?.status ?? 'draft',
      ...fields,
    }
    if (existing && JSON.stringify({ ...snapshot, savedAt: existing.savedAt }) === JSON.stringify(existing)) return existing
    writeLibrary(upsertSavedProcess(current, snapshot))
    return snapshot
  }

  const checkpointCurrentProcess = (lastScreen) => {
    if (!processIdentityState.id) return true
    try {
      const draftFields = PROCESS_SCREENS.includes(screen) ? { draft: JSON.parse(workspaceDraft) } : {}
      checkpointProcess(processIdentityState.id, lastScreen, draftFields)
      return true
    } catch {
      setProcessIdentityState((current) => ({
        ...current,
        error: 'Nie udało się zapisać bieżącego procesu w bibliotece. Sprawdź, czy proces jest otwarty w innej karcie.',
      }))
      return false
    }
  }

  const finishVersion = () => {
    if (completed || !processIdentityState.id || !reportSaved) return
    if (!asIsSaved || !analysisSaved || !toBeSaved || stakeholderFormPending || !validateReportAssignments()) {
      setReportError('Przed zakończeniem wersji zapisz wszystkie etapy i uzupełnij macierz RACI.')
      return
    }
    try {
      checkpointProcess(processIdentityState.id, 'report', {
        status: 'completed',
        version: activeProcess?.version ?? 1,
        seriesId: activeProcess?.seriesId ?? processIdentityState.id,
        draft: {},
      })
      setReportError('')
    } catch {
      setReportError('Nie udało się zakończyć wersji. Spróbuj ponownie po sprawdzeniu zapisu w przeglądarce.')
    }
  }

  const createProcessVersion = (source) => {
    let backup
    try {
      const current = readCurrentLibrary()
      if (source.status !== 'completed' || !isValidProcessId(source.id)) return
      const id = createProcessId(globalThis.crypto)
      const seriesId = source.seriesId ?? source.id
      const versions = current.filter((item) => (item?.seriesId ?? item?.id) === seriesId)
      const version = Math.max(1, ...versions.map((item) => item.version ?? 1)) + 1
      const library = upsertSavedProcess(current, {
        ...source, id, seriesId, version, status: 'draft', draft: {},
        lastScreen: source.sections.asIs ? 'as-is' : 'scope',
        savedAt: new Date().toISOString(),
      })
      if (current.some((item) => isValidProcessId(item?.id) && item.id.toLowerCase() === id.toLowerCase())) throw new Error('VERSION_ID_COLLISION')
      const targetKeys = getWorkshopStorageKeys(id).slice(0, 2)
      const sourceKeys = getWorkshopStorageKeys(source.id).slice(0, 2)
      backup = createStorageBackup(localStorage, targetKeys)
      if (backup.some((item) => item.existed)) throw new Error('VERSION_ID_COLLISION')
      sourceKeys.forEach((key, index) => {
        const raw = localStorage.getItem(key)
        if (raw !== null) localStorage.setItem(targetKeys[index], raw)
      })
      writeLibrary(library)
      setLibraryMessage(`Utworzono wersję ${version} jako szkic. Otwórz ją z biblioteki, aby zaktualizować proces.`)
    } catch {
      if (backup && !restoreStorageBackup(localStorage, backup)) {
        setLibraryStorageUncertain(true)
        setLibraryMessage('Nie udało się wycofać zapisu wersji. Sprawdź stan biblioteki przed wznowieniem pracy.')
        return
      }
      setLibraryMessage('Nie udało się utworzyć nowej wersji. Sprawdź dostępność zapisu lub odśwież bibliotekę.')
    }
  }

  const workspaceDraft = JSON.stringify({
    ...(screen === 'scope' && { scope: formData }),
    ...(!asIsSaved && (steps.length > 0 || asIsDescription || asIsFormPending) && {
      asIs: { steps, description: asIsDescription, form: stepDraft, editingId: editingStepId },
    }),
    ...(!analysisSaved && (screen === 'analysis' || findings.length > 0 || findingFormPending) && {
      analysis: { findings, form: findingDraft, editingId: editingFindingId },
    }),
    ...(!toBeSaved && (screen === 'to-be' || toBeSteps.length || toBeFormPending) && {
      toBe: {
        assumptions: toBeAssumptions, selectedFindingIds, steps: toBeSteps,
        externalLinks: toBeExternalLinks, externalSteps: toBeExternalSteps,
        copiedFromAsIs, form: toBeStepDraft, editingId: editingToBeStepId,
      },
    }),
    ...(!reportSaved && (screen === 'report' || stakeholderFormPending || Object.keys(raci).length > 0) && {
      report: { stakeholders, raci, form: stakeholderDraft, editingId: editingStakeholderId },
    }),
  })
  const persistWorkspaceDraft = useEffectEvent(() => {
    if (!processIdentityState.id || !PROCESS_SCREENS.includes(screen)) return
    try {
      checkpointProcess(processIdentityState.id, screen, { draft: JSON.parse(workspaceDraft) })
    } catch {
      setProcessIdentityState((current) => ({
        ...current, error: 'Nie udało się zapisać szkicu. Sprawdź dostępność pamięci przeglądarki lub drugą kartę aplikacji.',
      }))
    }
  })
  useEffect(() => {
    persistWorkspaceDraft()
  }, [screen, processIdentityState.id, workspaceDraft])

  const testSupabaseRead = async () => {
    if (!supabase) {
      setSupabaseTest({ status: 'configuration-error', count: null })
      return
    }

    setSupabaseTest({ status: 'loading', count: null })

    try {
      const { data, error } = await supabase
        .schema('public')
        .from('synthetic_processes')
        .select('id')

      if (error) {
        setSupabaseTest({ status: 'request-error', count: null })
        return
      }

      setSupabaseTest({ status: 'success', count: data?.length ?? 0 })
    } catch {
      setSupabaseTest({ status: 'request-error', count: null })
    }
  }

const startNewProcess = () => {
  if (initialLibrary.error) {
    setProcessIdentityState((current) => ({ ...current, error: initialLibrary.error }))
    return
  }
   const hasStartedProcess = Boolean(formData.processName?.trim())

  if (!hasStartedProcess) {
    let screenBackup

    try {
      screenBackup = createStorageBackup(
        sessionStorage,
        ['architekt-procesow-screen-to-open'],
      )
    } catch {
      setProcessIdentityState((current) => ({
        ...current,
        error: 'Nie udało się przygotować bezpiecznego rozpoczęcia nowego procesu.',
      }))
      return
    }

    try {
      assertActiveProcess()
      sessionStorage.removeItem('architekt-procesow-screen-to-open')
      removeCurrentProcessId(localStorage)
    } catch {
      const rollbackSucceeded = restoreStorageBackup(
        sessionStorage,
        screenBackup,
      )

      setProcessIdentityState((current) => ({
        ...current,
        error: rollbackSucceeded
          ? 'Nie udało się rozpocząć nowego procesu. Poprzedni ekran został przywrócony.'
          : 'Błąd krytyczny: nie udało się przywrócić poprzedniego ekranu. Nie kontynuuj edycji.',
      }))
      return
    }

    setProcessIdentityState({ id: null, error: '' })
    window.location.reload()
    return
  }
  const accepted = window.confirm(
    'Czy rozpocząć nowy proces? Bieżący proces zostanie zapisany w „Moich procesach”.'
  )

  if (!accepted) return

  try {
    const current = readCurrentLibrary()
    assertActiveProcess()
    const lastScreen = screen === 'processes' ? screenBeforeProcesses : screen
    if (processIdentityState.id) {
      const draftFields = PROCESS_SCREENS.includes(screen) ? { draft: JSON.parse(workspaceDraft) } : {}
      checkpointProcess(processIdentityState.id, lastScreen, draftFields)
    } else {
      const snapshot = buildProcessSnapshot({
        id: createProcessId(globalThis.crypto),
        name: formData.processName.trim(),
        savedAt: new Date().toISOString(),
        lastScreen: PROCESS_SCREENS.includes(lastScreen) ? lastScreen : 'scope',
        sections: readProcessSections(),
      })
      writeLibrary(upsertSavedProcess(current, { ...snapshot, status: 'draft' }))
    }
  } catch (error) {
    setProcessIdentityState((current) => ({
      ...current,
      error: error.message === 'LIBRARY_CHANGED' ? 'Biblioteka zmieniła się lub jest nieczytelna. Proces nie został zapisany ani zresetowany. Sprawdź dane przed odświeżeniem strony.' : 'Nie udało się zapisać procesu w bibliotece. Dane i tożsamość procesu zostały zachowane.',
    }))
    return
  }

  let sectionBackup
  let screenBackup

  try {
    sectionBackup = createStorageBackup(
      localStorage,
      PROCESS_SECTION_STORAGE_KEYS,
    )
    screenBackup = createStorageBackup(
      sessionStorage,
      ['architekt-procesow-screen-to-open'],
    )
  } catch {
    setProcessIdentityState((current) => ({
      ...current,
      error: 'Proces został zapisany, ale nie udało się przygotować bezpiecznego resetu.',
    }))
    return
  }

  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(AS_IS_STORAGE_KEY)
    localStorage.removeItem(ANALYSIS_STORAGE_KEY)
    localStorage.removeItem(TO_BE_STORAGE_KEY)
    localStorage.removeItem(REPORT_STORAGE_KEY)
    sessionStorage.removeItem('architekt-procesow-screen-to-open')
    removeCurrentProcessId(localStorage)
  } catch {
    const sectionsRestored = restoreStorageBackup(
      localStorage,
      sectionBackup,
    )
    const screenRestored = restoreStorageBackup(
      sessionStorage,
      screenBackup,
    )
    const rollbackSucceeded = sectionsRestored && screenRestored

    setProcessIdentityState((current) => ({
      ...current,
      error: rollbackSucceeded
        ? 'Proces został zapisany, ale reset nie powiódł się. Poprzedni workspace został przywrócony.'
        : 'Błąd krytyczny: proces został zapisany, ale nie udało się w pełni przywrócić workspace’u. Nie kontynuuj edycji.',
    }))
    return
  }

  setProcessIdentityState({ id: null, error: '' })
  window.location.reload()
}

const removeSavedProcess = (process) => {
  if (!isValidProcessId(process?.id)) { setLibraryMessage('Nie można usunąć procesu bez poprawnego identyfikatora.'); return }
  if (processIdentityState.id?.toLowerCase() === process.id.toLowerCase()) { setLibraryMessage('To obecnie otwarty proces. Rozpocznij lub otwórz inny proces przed usunięciem.'); return }
  if (!window.confirm(`Usunąć proces „${process.name}” z biblioteki oraz jego zapisany tekst warsztatu i propozycję w tej przeglądarce? Operacji nie można cofnąć. Inne procesy i wyeksportowane pliki pozostaną bez zmian.`)) return
  try {
    const remaining = deleteSavedProcess(localStorage, process.id, savedProcesses)
    updateLibrary(remaining)
    setLibraryMessage('Proces i zapisane dane jego warsztatu zostały usunięte z tej przeglądarki. Wyeksportowane pliki pozostają bez zmian.')
  } catch (error) {
    if (error.code === 'DELETE_ROLLBACK_FAILED') setLibraryStorageUncertain(true)
    setLibraryMessage(error.message)
  }
}

const openSavedProcess = (process) => {
  if (!isValidProcessId(process?.id)) {
    setProcessIdentityState((current) => ({
      ...current,
      error: 'Nie można otworzyć procesu, ponieważ jego identyfikator jest nieprawidłowy.',
    }))
    return
  }

  const normalizedProcessId = process.id.toLowerCase()
  try {
    readCurrentLibrary()
    assertActiveProcess()
  } catch {
    setProcessIdentityState((current) => ({ ...current, error: 'Biblioteka zmieniła się w innej karcie. Odśwież stronę przed otwarciem procesu.' }))
    return
  }
  const matchingProcessCount = savedProcesses.filter(
    (savedProcess) =>
      isValidProcessId(savedProcess?.id) &&
      savedProcess.id.toLowerCase() === normalizedProcessId,
  ).length

  if (matchingProcessCount > 1) {
    setProcessIdentityState((current) => ({
      ...current,
      error: 'Nie można otworzyć procesu, ponieważ biblioteka zawiera powielony identyfikator.',
    }))
    return
  }
  if (processIdentityState.id?.toLowerCase() === normalizedProcessId) {
    const lastScreen = PROCESS_SCREENS.includes(screenBeforeProcesses) ? screenBeforeProcesses : process.lastScreen
    setScreen(process.status === 'completed' ? 'report' : PROCESS_SCREENS.includes(lastScreen) ? lastScreen : 'scope')
    return
  }
  if (!checkpointCurrentProcess(screenBeforeProcesses)) return

  const sections = [
    [STORAGE_KEY, process.sections?.scope],
    [AS_IS_STORAGE_KEY, process.sections?.asIs],
    [ANALYSIS_STORAGE_KEY, process.sections?.analysis],
    [TO_BE_STORAGE_KEY, process.sections?.toBe],
    [REPORT_STORAGE_KEY, process.sections?.report],
  ]
  const editableScreens = ['scope', 'as-is', 'analysis', 'to-be', 'report']
  const nextScreen = process.status === 'completed' ? 'report' : editableScreens.includes(process.lastScreen)
    ? process.lastScreen
    : 'scope'
  let sectionBackups
  let screenBackup

  try {
    sectionBackups = sections.map(([storageKey]) => {
      const value = localStorage.getItem(storageKey)
      return { storageKey, existed: value !== null, value }
    })
    const screenValue = sessionStorage.getItem(
      'architekt-procesow-screen-to-open',
    )
    screenBackup = {
      existed: screenValue !== null,
      value: screenValue,
    }
  } catch {
    setProcessIdentityState((current) => ({
      ...current,
      error: 'Nie udało się przygotować bezpiecznego otwarcia procesu.',
    }))
    return
  }

  try {
    sections.forEach(([storageKey, sectionData]) => {
      if (sectionData) {
        localStorage.setItem(storageKey, sectionData)
      } else {
        localStorage.removeItem(storageKey)
      }
    })

    sessionStorage.setItem(
      'architekt-procesow-screen-to-open',
      nextScreen
    )
    activateProcessId(localStorage, process.id)
  } catch {
    let rollbackFailed = false

    sectionBackups.forEach(({ storageKey, existed, value }) => {
      try {
        if (existed) {
          localStorage.setItem(storageKey, value)
        } else {
          localStorage.removeItem(storageKey)
        }
      } catch {
        rollbackFailed = true
      }
    })

    try {
      if (screenBackup.existed) {
        sessionStorage.setItem(
          'architekt-procesow-screen-to-open',
          screenBackup.value,
        )
      } else {
        sessionStorage.removeItem('architekt-procesow-screen-to-open')
      }
    } catch {
      rollbackFailed = true
    }

    setProcessIdentityState((current) => ({
      ...current,
      error: rollbackFailed
        ? 'Błąd krytyczny: nie udało się przywrócić poprzednich danych procesu. Nie kontynuuj edycji.'
        : 'Nie udało się otworzyć procesu. Poprzednie dane zostały przywrócone.',
    }))
    return
  }

  const nextScope = loadSavedScope()
  const nextAsIs = loadSavedAsIs()
  const nextAnalysis = loadSavedAnalysis()
  const nextToBe = loadSavedToBe()
  const nextReport = loadSavedReport()
  const draft = process.draft

  setProcessIdentityState({ id: process.id, error: '' })
  setStartMethod(nextScope.startMethod)
  setWorkMode(nextScope.workMode)
  setFormData(draft?.scope ?? nextScope.data)
  setAsIsDescription(draft?.asIs?.description ?? nextAsIs.description)
  setSteps(draft?.asIs?.steps ?? nextAsIs.steps)
  setStepDraft(draft?.asIs?.form ?? emptyStep)
  setEditingStepId(draft?.asIs?.editingId ?? null)
  setExternalSteps(nextAsIs.externalSteps || [])
  setExternalLinks(nextAsIs.externalLinks ?? [])
  setAsIsSaved(!draft?.asIs && nextAsIs.isSaved)
  setFindings(draft?.analysis?.findings ?? nextAnalysis.findings)
  setFindingDraft(draft?.analysis?.form ?? emptyFinding)
  setEditingFindingId(draft?.analysis?.editingId ?? null)
  setAnalysisSaved(!draft?.analysis && nextAnalysis.isSaved)
  setToBeAssumptions(draft?.toBe?.assumptions ?? nextToBe.assumptions)
  setSelectedFindingIds(
    (draft?.toBe?.selectedFindingIds ?? nextToBe.selectedFindingIds ?? nextAnalysis.findings.map(({ id }) => id)).filter(
      (id) => (draft?.analysis?.findings ?? nextAnalysis.findings).some((finding) => finding.id === id),
    ),
  )
  setToBeSteps(draft?.toBe?.steps ?? nextToBe.steps)
  setToBeExternalSteps(draft?.toBe?.externalSteps ?? nextToBe.externalSteps ?? [])
  setToBeExternalLinks(draft?.toBe?.externalLinks ?? nextToBe.externalLinks ?? [])
  setToBeStepDraft(draft?.toBe?.form ?? emptyToBeStep)
  setEditingToBeStepId(draft?.toBe?.editingId ?? null)
  setToBeSaved(!draft?.toBe && nextToBe.isSaved)
  setCopiedFromAsIs(draft?.toBe?.copiedFromAsIs ?? nextToBe.copiedFromAsIs)
  setStakeholders(
    draft?.report?.stakeholders ?? (nextReport.initialized || nextReport.stakeholders.length > 0
      ? nextReport.stakeholders
      : buildSuggestedStakeholders(nextScope.data, nextAsIs.steps, nextToBe.steps)),
  )
  setRaci(draft?.report?.raci ?? nextReport.raci)
  setStakeholderDraft(draft?.report?.form ?? emptyStakeholder)
  setEditingStakeholderId(draft?.report?.editingId ?? null)
  setReportSaved(!draft?.report && nextReport.isSaved)
  setScreen(nextScreen)
}
  const startScope = (method) => {
    if (method !== startMethod) {
      setAsIsSaved(false)
    }
    setStartMethod(method)
    setScreen('scope')
    setScopeSaveError(false)
    setAsIsSaveError(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleScopeChange = (event) => {
    const { name, value } = event.target
    setFormData((currentData) => ({ ...currentData, [name]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [name]: undefined }))
    setScopeSaveError(false)
  }

  const handleScopeSubmit = (event) => {
    event.preventDefault()

    const validationErrors = Object.entries(requiredFields).reduce(
      (currentErrors, [field, message]) => {
        if (!formData[field].trim()) {
          currentErrors[field] = message
        }
        return currentErrors
      },
      {},
    )

    setErrors(validationErrors)
    setScopeSaveError(false)

    const firstInvalidField = Object.keys(validationErrors)[0]
    if (firstInvalidField) {
      document.getElementById(firstInvalidField)?.focus()
      return
    }

    let processId = processIdentityState.id
    let identitySaved = false
    let scopeSaved = false
    let librarySaved = false

    try {
      readCurrentLibrary()
      assertActiveProcess()
      processId ??= createProcessId(globalThis.crypto)
      saveCurrentProcessId(localStorage, processId)
      identitySaved = true
      setProcessIdentityState({ id: processId, error: '' })

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          data: formData,
          startMethod,
          workMode,
          savedAt: new Date().toISOString(),
        }),
      )
      scopeSaved = true
      checkpointProcess(processId, 'as-is')
      librarySaved = true
      sessionStorage.setItem(
        'architekt-procesow-screen-to-open',
        'as-is',
      )
      setScreen('as-is')
      setAsIsSaveError(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setProcessIdentityState((current) => ({
        id: identitySaved ? processId : current.id,
        error: librarySaved
          ? 'Zakres został zapisany, ale nie udało się zapamiętać ekranu AS-IS. Spróbuj ponownie.'
          : scopeSaved
            ? 'Zakres zapisano w bieżącym procesie, ale nie udało się dodać go do biblioteki.'
          : identitySaved
            ? 'Nie udało się zapisać Zakresu. Identyfikator procesu został zachowany do ponownej próby.'
            : 'Nie udało się utworzyć lub potwierdzić identyfikatora procesu. Zakres nie został zapisany.',
      }))
      setScopeSaveError(true)
    }
  }

  const handleDescriptionChange = (event) => {
    setAsIsDescription(event.target.value)
    setDescriptionError('')
    setAsIsError('')
    setAsIsSaved(false)
    setAsIsSaveError(false)
  }

  const handleStepChange = (event) => {
    const fieldMap = {
      ...bpmnStepFieldMap,
      stepName: 'name',
      stepDescription: 'description',
      stepOwner: 'owner',
      stepSystem: 'system',
      stepResult: 'result',
    }
    const field = fieldMap[event.target.name]
    setStepDraft((currentStep) => ({ ...currentStep, [field]: event.target.value }))
    if (field === 'name' || field === 'bpmnDocuments') {
      setStepError('')
    }
    setAsIsError('')
    setAsIsSaved(false)
    setAsIsSaveError(false)
  }

  const cancelStepEdit = () => {
    setStepDraft(emptyStep)
    setEditingStepId(null)
    setStepError('')
  }

  const transferWorkshopSteps = (names) => {
    if (startMethod !== 'steps') return { error: 'Przenoszenie jest dostępne w trybie dodawania kroków.' }
    try {
      const result = appendWorkshopSteps(steps, names, () => globalThis.crypto.randomUUID())
      if (result.added.length) {
        writeProcessSection(AS_IS_STORAGE_KEY, JSON.stringify({ description: asIsDescription, steps: result.steps, externalSteps, externalLinks, startMethod, savedAt: null }))
        setSteps(result.steps)
        setAsIsSaved(false)
        setAsIsSaveError(false)
        setAsIsError('')
      }
      return { added: result.added.length, skipped: result.skipped.length }
    } catch {
      return { error: 'Nie udało się przenieść kroków. Istniejąca lista nie została zmieniona.' }
    }
  }

  const useWorkshopFinding = (category, value) => {
    const field = category === 'roles' ? 'owner' : category === 'systems' ? 'system' : ['decisions', 'exceptions'].includes(category) ? 'description' : null
    if (startMethod !== 'steps' || !field || typeof value !== 'string' || !value.trim()) return { error: 'Nie udało się wstawić ustalenia.' }
    const existing = stepDraft[field]
    const selected = value.trim()
    if (field === 'description') {
      const entry = `${category === 'decisions' ? 'Decyzja' : 'Wyjątek'}: ${selected}`
      if (`\n${existing}\n`.includes(`\n${entry}\n`)) return { duplicate: true }
      setStepDraft((current) => ({ ...current, description: current.description ? `${current.description}\n${entry}` : entry }))
    } else {
      if (existing.trim() && existing.trim() !== selected && !window.confirm(`W formularzu kroku znajduje się już wartość: „${existing.trim()}”. Zastąpić ją wartością „${selected}”?`)) return { cancelled: true }
      setStepDraft((current) => ({ ...current, [field]: selected }))
    }
    setAsIsSaved(false)
    setAsIsSaveError(false)
    setAsIsError('')
    return { ok: true }
  }

  const saveConnectionChange = (nextSteps) => {
    try {
      writeProcessSection(AS_IS_STORAGE_KEY, JSON.stringify({ description: asIsDescription, steps: nextSteps, externalSteps, externalLinks, startMethod, savedAt: null }))
      setSteps(nextSteps)
      setAsIsSaved(false)
      setAsIsSaveError(false)
      return { ok: true }
    } catch { return { error: 'Nie udało się zapisać połączenia. Lista kroków nie została zmieniona.' } }
  }
  const addConnection = (sourceId, targetId, label) => {
    try { return saveConnectionChange(addProcessConnection(steps, sourceId, targetId, label)) }
    catch (error) { return { error: error.message } }
  }
  const removeConnection = (sourceId, index) => {
    const source = steps.find((step) => step.id === sourceId)
    if (decisionDraftFlags[sourceId] && source?.extraConnections?.length === 1 && !window.confirm('Usunięcie ostatniego przejścia usunie niezapisany formularz decyzji. Kontynuować?')) return { error: 'Nie usunięto połączenia.' }
    const result = saveConnectionChange(removeProcessConnection(steps, sourceId, index))
    if (!result.error && source?.extraConnections?.length === 1) onBpmnDraftChange(sourceId, false)
    return result
  }
  const saveBpmnDecision = (sourceId, question, mainLabel) => {
    try { return saveConnectionChange(setProcessDecision(steps, sourceId, question, mainLabel)) }
    catch (error) { return { error: error.message } }
  }
  const saveBpmnLane = (sourceId, laneName) => {
    try { return saveConnectionChange(setProcessLane(steps, sourceId, laneName)) }
    catch (error) { return { error: error.message } }
  }
  const addMessage = (stepId, primary, external, direction, label, externalStepId) => {
    try { return saveConnectionChange(addBpmnMessage(steps, stepId, primary, external, direction, label, externalStepId, externalSteps)) }
    catch (error) { return { error: error.message } }
  }
  const changeExternalSteps = (next) => {
    try {
      writeProcessSection(AS_IS_STORAGE_KEY, JSON.stringify({ description: asIsDescription, steps, externalSteps: next, externalLinks, startMethod, savedAt: null }))
      setExternalSteps(next); setAsIsSaved(false); setAsIsSaveError(false)
      return { ok: true }
    } catch { return { error: 'Nie udało się zapisać działań zewnętrznych.' } }
  }
  const changeExternalLinks = (next) => {
    try {
      writeProcessSection(AS_IS_STORAGE_KEY, JSON.stringify({ description: asIsDescription, steps, externalSteps, externalLinks: next, startMethod, savedAt: null }))
      setExternalLinks(next)
      setAsIsSaved(false)
      return { ok: true }
    } catch {
      return { error: 'Nie udało się zapisać przekazań między basenami.' }
    }
  }
  const removeMessage = (stepId, index) => saveConnectionChange(removeBpmnMessage(steps, stepId, index))

  const addOrUpdateStep = () => {
    if (!stepDraft.name.trim()) {
      setStepError('Uzupełnij nazwę kroku.')
      document.getElementById('stepName')?.focus()
      return
    }
    const documentError = getBpmnStepError(stepDraft)
    if (documentError) {
      setStepError(documentError)
      return
    }

    const nextSteps = editingStepId
  ? steps.map((step) =>
      step.id === editingStepId
        ? { ...step, ...stepDraft, id: editingStepId }
        : step,
    )
  : [
      ...steps,
      {
        ...stepDraft,
        id:
          globalThis.crypto?.randomUUID?.() ??
          `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
    ]

try {
      writeProcessSection(
        AS_IS_STORAGE_KEY,
        JSON.stringify({
          description: asIsDescription,
          steps: nextSteps,
          externalSteps,
          externalLinks,
          startMethod,
          savedAt: null,
        }),
      )
    } catch {
      setAsIsSaveError(true)
      setAsIsError('Nie udało się zapisać kroku. Spróbuj ponownie.')
      return
    }

    setSteps(nextSteps)
    setStepDraft(emptyStep)
    setEditingStepId(null)
    setStepError('')
    setAsIsError('')
    setAsIsSaved(false)
    setAsIsSaveError(false)
  }

  const editStep = (step) => {
    setStepDraft({
      ...readBpmnStepDraft(step),
      name: step.name,
      description: step.description,
      owner: step.owner,
      system: step.system,
      result: step.result,
    })
    setEditingStepId(step.id)
    setStepError('')
    document.getElementById('stepName')?.focus()
  }

  const deleteStep = (stepId) => {
    if (decisionDraftFlags['message-form']) { setAsIsError('Najpierw dodaj albo wyczyść niezapisaną wiadomość BPMN.'); return }
    const affectedDrafts = steps.filter((step) => decisionDraftFlags[step.id] && (step.id === stepId || (Array.isArray(step.extraConnections) && step.extraConnections.length > 0 && step.extraConnections.every((link) => link.targetId === stepId))))
    if ((affectedDrafts.length || decisionDraftFlags[`lane:${stepId}`]) && !window.confirm('Usunięcie kroku spowoduje utratę niezapisanych ustawień BPMN. Kontynuować?')) return
    for (const affected of affectedDrafts) onBpmnDraftChange(affected.id, false)
    onBpmnDraftChange(`lane:${stepId}`, false)
    setSteps((currentSteps) => removeStepConnections(currentSteps, stepId))
    if (editingStepId === stepId) {
      cancelStepEdit()
    }
    setAsIsSaved(false)
    setAsIsError('')
  }

  const moveStep = (index, direction) => {
    setSteps((currentSteps) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= currentSteps.length) {
        return currentSteps
      }

      const reorderedSteps = [...currentSteps]
      ;[reorderedSteps[index], reorderedSteps[targetIndex]] = [
        reorderedSteps[targetIndex],
        reorderedSteps[index],
      ]
      return reorderedSteps
    })
    setAsIsSaved(false)
  }

  const showScope = () => {
    setScreen('scope')
    setAsIsSaveError(false)
    setAsIsError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveAsIs = () => {
    if (decisionDraftDirty) { setAsIsError('Najpierw zapisz lub cofnij zmiany w formularzach BPMN.'); return }
    setAsIsSaved(false)
    setAsIsSaveError(false)
    setAsIsError('')

    if (asIsFormPending) {
      setAsIsError('Dokończ formularz kroku AS-IS przed zapisem procesu.')
      return
    }

    if (startMethod === 'steps' && steps.length === 0) {
      setAsIsError('Dodaj co najmniej jeden krok procesu.')
      return
    }

    if (startMethod !== 'steps' && !asIsDescription.trim()) {
      setDescriptionError('Opisz obecny przebieg procesu.')
      document.getElementById('asIsDescription')?.focus()
      return
    }

    try {
      writeProcessSection(
        AS_IS_STORAGE_KEY,
        JSON.stringify({
          description: asIsDescription,
          steps,
          externalSteps,
          externalLinks,
          startMethod,
          savedAt: new Date().toISOString(),
        }),
      )
      setAsIsSaved(checkpointCurrentProcess('as-is'))
    } catch {
      setAsIsSaveError(true)
    }
  }

  const continueToAnalysis = () => {
    if (asIsFormPending) {
      setAsIsError('Dokończ formularz kroku AS-IS przed przejściem do analizy.')
      return
    }
    const hasRequiredAsIs =
      startMethod === 'steps' ? steps.length > 0 : Boolean(asIsDescription.trim())

    if (!asIsSaved || !hasRequiredAsIs) {
      setAsIsError(
        startMethod === 'steps'
          ? 'Dodaj i zapisz co najmniej jeden krok procesu.'
          : 'Uzupełnij i zapisz opis obecnego procesu.',
      )
      return
    }

    if (!checkpointCurrentProcess('analysis')) return
    setScreen('analysis')
    setAnalysisError('')
    setAnalysisSaveError(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFindingChange = (event) => {
    const fieldMap = {
      findingCategory: 'category',
      findingName: 'name',
      findingLocation: 'location',
      findingSituation: 'situation',
      findingCause: 'cause',
      findingProcessImpact: 'processImpact',
      findingImpactLevel: 'impactLevel',
      findingImprovement: 'improvement',
    }
    const field = fieldMap[event.target.name]
    setFindingDraft((currentDraft) => ({
      ...currentDraft,
      [field]: event.target.value,
    }))
    setFindingErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
    setAnalysisError('')
    setAnalysisSaved(false)
    setAnalysisSaveError(false)
  }

  const cancelFindingEdit = () => {
    setFindingDraft(emptyFinding)
    setEditingFindingId(null)
    setFindingErrors({})
  }

  const useWorkshopException = (text) => {
    if (findingFormPending && !window.confirm('Zastąpić bieżący formularz analizy wyjątkiem z warsztatu?')) return false
    setFindingDraft({ ...emptyFinding, name: text })
    setEditingFindingId(null)
    setFindingErrors({})
    setAnalysisError('')
    setAnalysisSaved(false)
    setAnalysisSaveError(false)
    document.getElementById('findingCategory')?.focus()
    return true
  }

  const addOrUpdateFinding = () => {
    const validationErrors = {}
    if (!findingDraft.category) {
      validationErrors.category = 'Wybierz kategorię ustalenia.'
    }
    if (!findingDraft.name.trim()) {
      validationErrors.name = 'Uzupełnij nazwę problemu lub obserwacji.'
    }

    setFindingErrors(validationErrors)
    const firstError = Object.keys(validationErrors)[0]
    if (firstError) {
      const fieldId = firstError === 'category' ? 'findingCategory' : 'findingName'
      document.getElementById(fieldId)?.focus()
      return
    }

    if (editingFindingId) {
      setFindings((currentFindings) =>
        currentFindings.map((finding) =>
          finding.id === editingFindingId
            ? { ...findingDraft, id: editingFindingId }
            : finding,
        ),
      )
    } else {
      const id =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`
      setFindings((currentFindings) => [
        ...currentFindings,
        { ...findingDraft, id },
      ])
      setSelectedFindingIds((currentIds) => [...currentIds, id])
    }

    setFindingDraft(emptyFinding)
    setEditingFindingId(null)
    setFindingErrors({})
    setAnalysisError('')
    setAnalysisSaved(false)
  }

  const editFinding = (finding) => {
    setFindingDraft({
      category: finding.category,
      name: finding.name,
      location: finding.location,
      situation: finding.situation,
      cause: finding.cause,
      processImpact: finding.processImpact,
      impactLevel: finding.impactLevel,
      improvement: finding.improvement,
    })
    setEditingFindingId(finding.id)
    setFindingErrors({})
    document.getElementById('findingCategory')?.focus()
  }

  const deleteFinding = (findingId) => {
    setFindings((currentFindings) =>
      currentFindings.filter((finding) => finding.id !== findingId),
    )
    if (editingFindingId === findingId) {
      cancelFindingEdit()
    }
    setSelectedFindingIds((currentIds) =>
      currentIds.filter((id) => id !== findingId),
    )
    setAnalysisSaved(false)
    setAnalysisError('')
  }

  const saveAnalysis = () => {
    setAnalysisError('')
    setAnalysisSaved(false)
    setAnalysisSaveError(false)

    if (findingFormPending) {
      setAnalysisError('Dokończ formularz ustalenia przed zapisem analizy.')
      return
    }

    if (findings.length === 0) {
      setAnalysisError('Dodaj co najmniej jedno ustalenie analityczne.')
      return
    }

    try {
      writeProcessSection(
        ANALYSIS_STORAGE_KEY,
        JSON.stringify({
          findings,
          startMethod,
          savedAt: new Date().toISOString(),
        }),
      )
      setAnalysisSaved(checkpointCurrentProcess('analysis'))
    } catch {
      setAnalysisSaveError(true)
    }
  }

  const showAsIs = () => {
    setScreen('as-is')
    setAnalysisError('')
    setAnalysisSaveError(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const continueToToBe = () => {
    if (findingFormPending) {
      setAnalysisError('Dokończ formularz ustalenia przed przejściem do TO-BE.')
      return
    }
    if (!analysisSaved || findings.length === 0) {
      setAnalysisError('Dodaj i zapisz co najmniej jedno ustalenie analityczne.')
      return
    }
    if (!checkpointCurrentProcess('to-be')) return
    setScreen('to-be')
    setToBeError('')
    setToBeSaveError(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleToBeAssumptionChange = (event) => {
    const fieldMap = {
      toBeChangeGoal: 'changeGoal',
      toBeExpectedResult: 'expectedResult',
      toBeConstraints: 'constraints',
      toBeSuccessMeasures: 'successMeasures',
    }
    const field = fieldMap[event.target.name]
    setToBeAssumptions((current) => ({ ...current, [field]: event.target.value }))
    if (field === 'changeGoal') {
      setToBeAssumptionError('')
    }
    setToBeSaved(false)
    setToBeSaveError(false)
  }

  const toggleToBeFinding = (findingId) => {
    setSelectedFindingIds((currentIds) =>
      currentIds.includes(findingId)
        ? currentIds.filter((id) => id !== findingId)
        : [...currentIds, findingId],
    )
    setToBeSaved(false)
  }

  const handleToBeStepChange = (event) => {
    const fieldMap = {
      ...bpmnStepFieldMap,
      toBeStepName: 'name',
      toBeStepDescription: 'description',
      toBeStepOwner: 'owner',
      toBeStepSystem: 'system',
      toBeStepResult: 'result',
      toBeStepType: 'stepType',
      toBeStepFinding: 'findingId',
      toBeStepAutomatable: 'automatable',
    }
    updateToBeStepField(fieldMap[event.target.name], event.target.value)
  }

  const changeToBeStepDraft = (updateDraft, clearError) => {
    setToBeStepDraft(updateDraft)
    if (clearError) setToBeStepError('')
    setToBeSaved(false)
    setToBeSaveError(false)
    setCopyMessage('')
  }

  const updateToBeStepField = (field, value) => {
    changeToBeStepDraft((current) => ({
      ...current,
      [field]: typeof value === 'function' ? value(current[field]) : value,
      ...(field === 'findingId' && {
        additionalFindingIds: current.additionalFindingIds.filter((id) => id !== value),
      }),
    }), field === 'name' || field === 'bpmnDocuments')
  }

  const toggleAdditionalToBeFinding = (findingId) => {
    updateToBeStepField('additionalFindingIds', (ids) => ids.includes(findingId)
      ? ids.filter((id) => id !== findingId)
      : [...ids, findingId])
  }

  const cancelToBeStepEdit = () => {
    setToBeStepDraft(emptyToBeStep)
    setEditingToBeStepId(null)
    setToBeStepError('')
  }

  const addOrUpdateToBeStep = () => {
    if (!toBeStepDraft.name.trim()) {
      setToBeStepError('Uzupełnij nazwę kroku.')
      document.getElementById('toBeStepName')?.focus()
      return
    }
    const documentError = getBpmnStepError(toBeStepDraft)
    if (documentError) {
      setToBeStepError(documentError)
      return
    }

    if (editingToBeStepId) {
      setToBeSteps((currentSteps) =>
        currentSteps.map((step) =>
          step.id === editingToBeStepId
            ? { ...step, ...toBeStepDraft, id: editingToBeStepId }
            : step,
        ),
      )
    } else {
      const id =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`
      setToBeSteps((currentSteps) => [...currentSteps, { ...toBeStepDraft, id }])
    }

    setToBeStepDraft(emptyToBeStep)
    setEditingToBeStepId(null)
    setToBeStepError('')
    setToBeError('')
    setToBeSaved(false)
    setCopyMessage('')
  }

  const editToBeStep = (step) => {
    setToBeStepDraft({
      ...readBpmnStepDraft(step),
      name: step.name,
      description: step.description,
      owner: step.owner,
      system: step.system,
      result: step.result,
      stepType: step.stepType,
      findingId: step.findingId,
      additionalFindingIds: getToBeFindingIds(step).filter((id) => id !== step.findingId),
      automatable: step.automatable,
    })
    setEditingToBeStepId(step.id)
    setToBeStepError('')
    document.getElementById('toBeStepName')?.focus()
  }

  const deleteToBeStep = (stepId) => {
    setToBeSteps((currentSteps) =>
      removeStepConnections(currentSteps, stepId),
    )
    if (editingToBeStepId === stepId) {
      cancelToBeStepEdit()
    }
    setToBeSaved(false)
    setToBeError('')
    setCopyMessage('')
  }

  const moveToBeStep = (index, direction) => {
    setToBeSteps((currentSteps) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= currentSteps.length) {
        return currentSteps
      }
      const reordered = [...currentSteps]
      ;[reordered[index], reordered[targetIndex]] = [
        reordered[targetIndex],
        reordered[index],
      ]
      return reordered
    })
    setToBeSaved(false)
  }

  const copyAsIsSteps = ({ includeBpmn = false } = {}) => {
    setCopyMessage('')
    setCopyError('')

    if (toBeSteps.length > 0) {
      setCopyError(
        'Lista TO-BE zawiera już kroki. Usuń je, jeśli chcesz rozpocząć od ponownego kopiowania.',
      )
      return
    }
    if (includeBpmn && (toBeExternalSteps.length || toBeExternalLinks.length)) {
      setCopyError('TO-BE zawiera już dane uczestników zewnętrznych.')
      return
    }
    if (steps.length === 0) {
      setCopyError('Brak kroków AS-IS do skopiowania.')
      return
    }

    const copiedSteps = steps.map((step, index) => ({
      ...emptyToBeStep,
      ...readBpmnStepDraft(step),
      name: step.name,
      description: step.description,
      owner: step.owner,
      system: step.system,
      result: step.result,
      stepType: 'Bez zmian',
      id: `as-is-copy-${step.id}-${index}`,
      sourceAsIsStepId: step.id,
    }))
    if (includeBpmn) {
      try {
        const copy = copyAsIsBpmn(steps, externalSteps, externalLinks, copiedSteps)
        setToBeSteps(copy.steps)
        setToBeExternalSteps(copy.externalSteps)
        setToBeExternalLinks(copy.externalLinks)
      } catch (error) {
        setCopyError(`Popraw mapę AS-IS przed skopiowaniem. ${error.message}`)
        return
      }
    } else {
      setToBeSteps(copiedSteps)
    }
    setCopiedFromAsIs(true)
    setCopyMessage(includeBpmn
      ? 'Mapa BPMN AS-IS została skopiowana. Sprawdź ją, dostosuj i zapisz proces TO-BE.'
      : 'Kroki AS-IS zostały skopiowane do procesu TO-BE.')
    setToBeError('')
    setToBeSaved(false)
  }

  const changeToBeConnections = (change, ...args) => {
    try {
      setToBeSteps(change(toBeSteps, ...args))
      setToBeSaved(false)
      return {}
    } catch (error) {
      return { error: error.message }
    }
  }

  const saveToBe = () => {
    setToBeSaved(false)
    setToBeSaveError(false)

    if (toBeFormPending) {
      setToBeError('Dokończ formularz kroku TO-BE przed zapisem procesu.')
      return
    }

    const isGoalMissing = !toBeAssumptions.changeGoal.trim()
    const areStepsMissing = toBeSteps.length === 0

    setToBeAssumptionError(
      isGoalMissing ? 'Uzupełnij cel projektowanej zmiany.' : '',
    )
    setToBeError(
      areStepsMissing ? 'Dodaj co najmniej jeden krok procesu TO-BE.' : '',
    )

    if (isGoalMissing) {
      document.getElementById('toBeChangeGoal')?.focus()
    }

    if (isGoalMissing || areStepsMissing) {
      return
    }

    try {
      writeProcessSection(
        TO_BE_STORAGE_KEY,
        JSON.stringify({
          assumptions: toBeAssumptions,
          selectedFindingIds,
          steps: toBeSteps,
          externalSteps: toBeExternalSteps,
          externalLinks: toBeExternalLinks,
          copiedFromAsIs,
          savedAt: new Date().toISOString(),
        }),
      )
      setToBeSaved(checkpointCurrentProcess('to-be'))
    } catch {
      setToBeSaveError(true)
    }
  }

  const showAnalysis = () => {
    setScreen('analysis')
    setToBeError('')
    setToBeSaveError(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const continueToReport = () => {
    if (toBeFormPending) {
      setToBeError('Dokończ formularz kroku TO-BE przed przejściem do raportu.')
      return
    }
    if (
      !toBeSaved ||
      !toBeAssumptions.changeGoal.trim() ||
      toBeSteps.length === 0
    ) {
      setToBeError('Zapisz poprawnie uzupełniony proces TO-BE.')
      return
    }
    if (!savedReport.initialized && stakeholders.length === 0) {
      setStakeholders(buildSuggestedStakeholders(formData, steps, toBeSteps))
    }
    if (!checkpointCurrentProcess('report')) return
    setScreen('report')
    setReportError('')
    setReportSaveError(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleStakeholderChange = (event) => {
    const fieldMap = {
      stakeholderName: 'name',
      stakeholderType: 'type',
      stakeholderInfluence: 'influence',
      stakeholderInterest: 'interest',
      stakeholderExpectations: 'expectations',
      stakeholderEngagement: 'engagement',
    }
    const field = fieldMap[event.target.name]
    setStakeholderDraft((current) => ({
      ...current,
      [field]: event.target.value,
    }))
    if (field === 'name') setStakeholderError('')
    setReportSaved(false)
    setReportSaveError(false)
  }

  const cancelStakeholderEdit = () => {
    setStakeholderDraft(emptyStakeholder)
    setEditingStakeholderId(null)
    setStakeholderError('')
  }

  const addOrUpdateStakeholder = () => {
    const cleanName = stakeholderDraft.name.trim()
    if (!cleanName) {
      setStakeholderError('Uzupełnij nazwę interesariusza.')
      document.getElementById('stakeholderName')?.focus()
      return
    }
    const duplicate = stakeholders.some(
      (item) =>
        item.id !== editingStakeholderId &&
        item.name.trim().toLocaleLowerCase('pl') ===
          cleanName.toLocaleLowerCase('pl'),
    )
    if (duplicate) {
      setStakeholderError('Taki interesariusz już istnieje.')
      document.getElementById('stakeholderName')?.focus()
      return
    }

    if (editingStakeholderId) {
      setStakeholders((current) =>
        current.map((item) =>
          item.id === editingStakeholderId
            ? { ...stakeholderDraft, name: cleanName, id: editingStakeholderId }
            : item,
        ),
      )
    } else {
      const id =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`
      setStakeholders((current) => [
        ...current,
        { ...stakeholderDraft, name: cleanName, id },
      ])
    }
    setStakeholderDraft(emptyStakeholder)
    setEditingStakeholderId(null)
    setStakeholderError('')
    setReportError('')
    setReportSaved(false)
  }

  const editStakeholder = (item) => {
    setStakeholderDraft({
      name: item.name,
      type: item.type,
      influence: item.influence,
      interest: item.interest,
      expectations: item.expectations,
      engagement: item.engagement,
    })
    setEditingStakeholderId(item.id)
    setStakeholderError('')
    document.getElementById('stakeholderName')?.focus()
  }

  const deleteStakeholder = (stakeholderId) => {
    setStakeholders((current) =>
      current.filter((item) => item.id !== stakeholderId),
    )
    setRaci((current) =>
      Object.fromEntries(
        Object.entries(current).map(([stepId, assignments]) => {
          const nextAssignments = { ...assignments }
          delete nextAssignments[stakeholderId]
          return [stepId, nextAssignments]
        }),
      ),
    )
    if (editingStakeholderId === stakeholderId) cancelStakeholderEdit()
    setReportSaved(false)
    setReportError('')
  }

  const handleRaciChange = (stepId, stakeholderId, value) => {
    setRaci((current) => ({
      ...current,
      [stepId]: {
        ...(current[stepId] ?? {}),
        [stakeholderId]: value,
      },
    }))
    setRaciErrors((current) => ({ ...current, [stepId]: undefined }))
    setReportSaved(false)
    setReportSaveError(false)
  }

  const validateReportAssignments = () => {
    if (stakeholders.length === 0) {
      setReportError('Dodaj co najmniej jednego interesariusza.')
      document.getElementById('stakeholderName')?.focus()
      return false
    }

    const validationErrors = getRaciValidationErrors(toBeSteps, raci)
    setRaciErrors(validationErrors)
    const firstInvalidIndex = toBeSteps.findIndex((step) => validationErrors[step.id]?.length)
    if (firstInvalidIndex < 0) return true

    const step = toBeSteps[firstInvalidIndex]
    setReportError(`Uzupełnij macierz RACI w kroku ${firstInvalidIndex + 1}. ${step.name}`)
    document.getElementById(`raci-step-${step.id}`)?.focus()
    return false
  }

  const saveReport = () => {
    setReportError('')
    setReportSaved(false)
    setReportSaveError(false)

    if (stakeholderFormPending) {
      setReportError('Dokończ formularz interesariusza przed zapisem raportu.')
      return
    }

    if (!validateReportAssignments()) return

    try {
      writeProcessSection(
        REPORT_STORAGE_KEY,
        JSON.stringify({
          stakeholders,
          raci,
          initialized: true,
          savedAt: new Date().toISOString(),
        }),
      )
      setReportSaved(checkpointCurrentProcess('report'))
    } catch {
      setReportSaveError(true)
    }
  }

  const exportReport = async () => {
    if (printPreparingRef.current) return
    if (stakeholderFormPending) {
      setReportError('Dokończ formularz interesariusza przed eksportem PDF.')
      return
    }
    setReportSaveError(false)
    if (!validateReportAssignments()) return

    setReportError('')
    printPreparingRef.current = true
    setPrintPreparing(true)
    let bpmn = { svg: '', error: '', toBeSvg: '', toBeError: '' }
    if (startMethod === 'steps') {
      const error = getDecisionBpmnError(steps, externalSteps, externalLinks)
      if (error) bpmn.error = error
      else {
        try {
          const { createPrintBpmn } = await import('./createPrintBpmn')
          const svg = await createPrintBpmn({ steps, externalSteps, externalLinks, scope: formData })
          const image = new Image()
          image.src = svg
          if (typeof image.decode === 'function') await image.decode()
          bpmn.svg = svg
        } catch { bpmn.error = 'nie udało się przygotować diagramu; sprawdź podgląd BPMN i spróbuj ponownie' }
      }
    }
    const toBeError = getDecisionBpmnError(toBeSteps, toBeExternalSteps, toBeExternalLinks)
    if (toBeError) bpmn.toBeError = toBeError
    else {
      try {
        const { createPrintBpmn } = await import('./createPrintBpmn')
        const svg = await createPrintBpmn({ steps: toBeSteps, externalSteps: toBeExternalSteps, externalLinks: toBeExternalLinks, scope: toBeBpmnScope(formData) })
        const image = new Image()
        image.src = svg
        if (typeof image.decode === 'function') await image.decode()
        bpmn.toBeSvg = svg
      } catch { bpmn.toBeError = 'nie udało się przygotować diagramu; sprawdź podgląd BPMN TO-BE i spróbuj ponownie' }
    }
    setPrintBpmn(bpmn)
    setPrintGeneratedAt(new Date())

    const previousTitle = document.title
    const safeProcessName = (formData.processName || 'Proces')
      .replace(/[<>:"/\\|?*]/g, ' ')
      .split('')
      .filter((character) => character.charCodeAt(0) >= 32)
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'Proces'
    document.title = completed
      ? `${completedProcessExportStem(formData.processName, activeProcess?.version)}-raport`
      : `Raport procesu - ${safeProcessName}`

    let titleRestored = false
    const restoreTitle = () => {
      if (titleRestored) return
      titleRestored = true
      document.title = previousTitle
      window.removeEventListener('afterprint', restoreTitle)
    }

    window.addEventListener('afterprint', restoreTitle, { once: true })
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        try {
          window.print()
        } finally {
          window.setTimeout(restoreTitle, 500)
          printPreparingRef.current = false
          setPrintPreparing(false)
        }
      })
    })
  }

  const showToBe = () => {
    setScreen('to-be')
    setReportError('')
    setReportSaveError(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeStage =
    screen === 'report'
      ? 4
      : screen === 'to-be'
        ? 3
        : screen === 'analysis'
          ? 2
          : screen === 'as-is'
            ? 1
            : 0

  if (libraryStorageUncertain) return <main><p role="alert">{libraryMessage}</p></main>

  return (
    <div className="app-shell">
      <AppHeader
  onHome={() => { if (canLeaveWorkshop()) startNewProcess() }}
  onTestSupabase={testSupabaseRead}
  supabaseTest={supabaseTest}
  onProcesses={() => {
  if (screen === 'processes') return
  if (!canLeaveWorkshop()) return
  if (!initialLibrary.error && !checkpointCurrentProcess(screen)) return
  setScreenBeforeProcesses(screen)
  setScreen('processes')
}}
/>
      {processIdentityState.error && (
        <div className="save-message storage-error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Nie udało się wykonać operacji na procesie</strong>
            <small>{processIdentityState.error}</small>
          </div>
        </div>
      )}
      <main>
       {screen === 'processes' && libraryMessage && <p role="status">{libraryMessage}</p>}
       {screen !== 'processes' && (
  <ProcessProgress activeStage={activeStage} />
)}

{screen === 'processes' && initialLibrary.error ? (
  <section><p role="alert">{initialLibrary.error}</p><button type="button" onClick={() => setScreen(screenBeforeProcesses)}>Wróć do procesu</button></section>
) : screen === 'processes' ? (
  <ProcessesScreen

    processes={savedProcesses}
    onOpen={openSavedProcess}
    onDelete={removeSavedProcess}
    onCreateVersion={createProcessVersion}
    currentId={processIdentityState.id}
    onBack={() => setScreen(screenBeforeProcesses)}
  />
) : screen === 'start' ? (
  <StartScreen onStart={startScope} workMode={workMode} onWorkModeChange={changeWorkMode} />
        ) : screen === 'scope' ? (
          <ScopeForm
            formData={formData}
            errors={errors}
            startMethod={startMethod}
            saved={false}
            saveError={scopeSaveError}
            onBack={startNewProcess}
            onChange={handleScopeChange}
            onSubmit={handleScopeSubmit}
          />
        ) : screen === 'as-is' ? (
          <AsIsScreen
            processId={processIdentityState.id}
            workshopDirtyRef={workshopDirtyRef}
            workshopRecordingRef={workshopRecordingRef}
            onTransferWorkshopSteps={transferWorkshopSteps}
            onUseWorkshopFinding={useWorkshopFinding}
            onAddConnection={addConnection}
            onRemoveConnection={removeConnection}
            onSaveBpmnDecision={saveBpmnDecision}
            onSaveBpmnLane={saveBpmnLane}
            externalSteps={externalSteps}
            onExternalStepsChange={changeExternalSteps}
            externalLinks={externalLinks}
            onExternalLinksChange={changeExternalLinks}
            onAddBpmnMessage={addMessage}
            onRemoveBpmnMessage={removeMessage}
            onBpmnDraftChange={onBpmnDraftChange}
            bpmnDraftDirty={decisionDraftDirty}
            scope={formData}
            startMethod={startMethod}
            description={asIsDescription}
            descriptionError={descriptionError}
            steps={steps}
            stepDraft={stepDraft}
            stepError={stepError}
            editingStepId={editingStepId}
            asIsError={asIsError}
            saved={asIsSaved}
            saveError={asIsSaveError}
            onDescriptionChange={handleDescriptionChange}
            onStepChange={handleStepChange}
            onAddStep={addOrUpdateStep}
            onEditStep={editStep}
            onDeleteStep={deleteStep}
            onMoveStep={moveStep}
            onCancelEdit={cancelStepEdit}
            onBack={() => { if (canLeaveWorkshop()) showScope() }}
            onSave={saveAsIs}
            onContinue={() => { if (canLeaveWorkshop()) continueToAnalysis() }}
          />
        ) : screen === 'analysis' ? (
          <AnalysisScreen
            key={processIdentityState.id}
            processId={processIdentityState.id}
            scope={formData}
            startMethod={startMethod}
            steps={steps}
            findings={findings}
            draft={findingDraft}
            errors={findingErrors}
            editingId={editingFindingId}
            analysisError={analysisError}
            saved={analysisSaved}
            saveError={analysisSaveError}
            onChange={handleFindingChange}
            onUseWorkshopException={useWorkshopException}
            onAdd={addOrUpdateFinding}
            onEdit={editFinding}
            onDelete={deleteFinding}
            onCancelEdit={cancelFindingEdit}
            onBack={showAsIs}
            onSave={saveAnalysis}
            onContinue={continueToToBe}
          />
        ) : screen === 'to-be' ? (
          <ToBeScreen
            scope={formData}
            startMethod={startMethod}
            asIsSteps={steps}
            findings={findings}
            assumptions={toBeAssumptions}
            assumptionError={toBeAssumptionError}
            selectedFindingIds={selectedFindingIds}
            steps={toBeSteps}
            stepDraft={toBeStepDraft}
            stepError={toBeStepError}
            editingStepId={editingToBeStepId}
            copyMessage={copyMessage}
            copyError={copyError}
            toBeError={toBeError}
            saved={toBeSaved}
            saveError={toBeSaveError}
            onAssumptionChange={handleToBeAssumptionChange}
            onToggleFinding={toggleToBeFinding}
            onStepChange={handleToBeStepChange}
            onUseImprovement={(name) => updateToBeStepField('name', name)}
            onUseSuggestion={(fields) => changeToBeStepDraft((current) => ({ ...current, ...fields }), true)}
            onToggleAdditionalFinding={toggleAdditionalToBeFinding}
            onAddStep={addOrUpdateToBeStep}
            onEditStep={editToBeStep}
            onDeleteStep={deleteToBeStep}
            onMoveStep={moveToBeStep}
            onCancelEdit={cancelToBeStepEdit}
            onCopySteps={copyAsIsSteps}
            onAddConnection={(...args) => changeToBeConnections(addProcessConnection, ...args)}
            onRemoveConnection={(...args) => changeToBeConnections(removeProcessConnection, ...args)}
            onSaveBpmnDecision={(...args) => changeToBeConnections(setProcessDecision, ...args)}
            externalSteps={toBeExternalSteps}
            externalLinks={toBeExternalLinks}
            onExternalLinksChange={(next) => {
              setToBeExternalLinks(next)
              setToBeSaved(false)
              return {}
            }}
            onSaveBpmnLane={(...args) => changeToBeConnections(setProcessLane, ...args)}
            onExternalStepsChange={(next) => {
              setToBeExternalSteps(next)
              setToBeSaved(false)
              return {}
            }}
            onAddBpmnMessage={(...args) => changeToBeConnections(addBpmnMessage, ...args, toBeExternalSteps)}
            onRemoveBpmnMessage={(...args) => changeToBeConnections(removeBpmnMessage, ...args)}
            onBack={showAnalysis}
            onSave={saveToBe}
            onContinue={continueToReport}
          />
        ) : (
          <ReportScreen
            key={processIdentityState.id}
            processId={processIdentityState.id}
            completed={completed}
            completedVersion={completed ? activeProcess?.version ?? 1 : undefined}
            scope={formData}
            startMethod={startMethod}
            asIsDescription={asIsDescription}
            asIsSteps={steps}
            externalSteps={externalSteps}
            toBeExternalSteps={toBeExternalSteps}
            externalLinks={externalLinks}
            toBeExternalLinks={toBeExternalLinks}
            printBpmn={printBpmn}
            printPreparing={printPreparing}
            findings={findings}
            toBeAssumptions={toBeAssumptions}
            selectedFindingIds={selectedFindingIds}
            toBeSteps={toBeSteps}
            stakeholders={stakeholders}
            stakeholderDraft={stakeholderDraft}
            stakeholderError={stakeholderError}
            editingStakeholderId={editingStakeholderId}
            raci={raci}
            raciErrors={raciErrors}
            reportError={reportError}
            saved={reportSaved}
            saveError={reportSaveError}
            onStakeholderChange={handleStakeholderChange}
            onAddStakeholder={addOrUpdateStakeholder}
            onEditStakeholder={editStakeholder}
            onDeleteStakeholder={deleteStakeholder}
            onCancelStakeholder={cancelStakeholderEdit}
            onRaciChange={handleRaciChange}
            onBack={showToBe}
            onSave={saveReport}
            onFinish={finishVersion}
            onExport={exportReport}
            printGeneratedAt={printGeneratedAt}
          />
        )}
      </main>
      <footer>
        <span>Twój proces jest zapisywany lokalnie</span>
        <span>Architekt Procesów · Wersja robocza</span>
      </footer>
    </div>
  )
}

export default App
