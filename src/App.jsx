import { Fragment, useState } from 'react'
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

const stages = ['Zakres', 'AS-IS', 'Analiza', 'TO-BE', 'Raport']
const STORAGE_KEY = 'architekt-procesow:scope'
const AS_IS_STORAGE_KEY = 'architekt-procesow:as-is'
const ANALYSIS_STORAGE_KEY = 'architekt-procesow:analysis'
const TO_BE_STORAGE_KEY = 'architekt-procesow:to-be'
const REPORT_STORAGE_KEY = 'architekt-procesow:report'

const findingCategories = [
  'Wąskie gardło',
  'Ryzyko lub możliwość błędu',
  'Zbędna lub powtarzalna czynność',
  'Niejasna odpowiedzialność',
  'Problem z komunikacją lub przekazaniem',
  'Miejsce do automatyzacji',
  'Inne',
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

const emptyStep = {
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
  name: '',
  description: '',
  owner: '',
  system: '',
  result: '',
  stepType: 'Nowy',
  findingId: '',
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

function loadSavedScope() {
  try {
    const savedScope = JSON.parse(localStorage.getItem(STORAGE_KEY))

    if (!savedScope || typeof savedScope !== 'object') {
      return { data: emptyScope, startMethod: null }
    }

    return {
      data: { ...emptyScope, ...savedScope.data },
      startMethod: savedScope.startMethod ?? null,
    }
  } catch {
    return { data: emptyScope, startMethod: null }
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

function AppHeader({ onHome }) {
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
      <span className="status-badge">
        <span aria-hidden="true">●</span>
        Nowy proces
      </span>
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

function StartScreen({ onStart }) {
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
          <button className="mode-button selected" type="button" aria-pressed="true">
            <span className="mode-icon" aria-hidden="true">✦</span>
            <span>
              <strong>Tryb z przewodnikiem</strong>
              <small>Dla osób bez doświadczenia</small>
            </span>
            <span className="check" aria-hidden="true">✓</span>
          </button>
          <button className="mode-button" type="button" aria-pressed="false">
            <span className="mode-icon expert" aria-hidden="true">⌁</span>
            <span>
              <strong>Tryb ekspercki</strong>
              <small>Dla osób znających analizę procesów</small>
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
            error={stepError}
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

      {isStepsVariant ? (
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
  onChange,
  onSubmit,
  onCancel,
}) {
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
  onAdd,
  onEdit,
  onDelete,
  onCancelEdit,
  onBack,
  onSave,
  onContinue,
}) {
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

function IncludedFindings({
  findings,
  selectedIds,
  steps,
  startMethod,
  onToggle,
}) {
  const locationLabel = (finding) => {
    if (!finding.location) return 'Nie wskazano miejsca'
    if (startMethod !== 'steps') return finding.location
    const index = steps.findIndex((step) => step.id === finding.location)
    return index >= 0 ? `${index + 1}. ${steps[index].name}` : 'Krok niedostępny'
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
  copyMessage,
  copyError,
  onChange,
  onAdd,
  onCancel,
  onCopy,
}) {
  const findingOptions = findings.map((finding) => ({
    value: finding.id,
    label: finding.name,
  }))

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
        {startMethod === 'steps' && (
          <button
            className="copy-steps-button"
            type="button"
            onClick={onCopy}
            disabled={hasSteps}
            title={hasSteps ? 'Lista TO-BE zawiera już kroki' : undefined}
          >
            <span aria-hidden="true">⧉</span>
            Skopiuj kroki z AS-IS
          </button>
        )}
      </div>

      {copyMessage && (
        <div className="inline-message copied-message" role="status">
          <span aria-hidden="true">✓</span>
          Kroki AS-IS zostały skopiowane do procesu TO-BE.
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
            error={error}
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
          <SelectField
            id="toBeStepFinding"
            label="Powiązane usprawnienie"
            value={draft.findingId}
            onChange={onChange}
            options={findingOptions}
            placeholder="Brak powiązania"
          />
          <SelectField
            id="toBeStepAutomatable"
            label="Czy krok może zostać zautomatyzowany?"
            value={draft.automatable}
            onChange={onChange}
            options={['Tak', 'Nie']}
            placeholder=""
          />
        </div>
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
  onMove,
}) {
  const findingName = (findingId) =>
    findings.find((finding) => finding.id === findingId)?.name

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
                  {step.findingId && findingName(step.findingId) && (
                    <span>Usprawnienie: {findingName(step.findingId)}</span>
                  )}
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
  onAddStep,
  onEditStep,
  onDeleteStep,
  onMoveStep,
  onCancelEdit,
  onCopySteps,
  onBack,
  onSave,
  onContinue,
}) {
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
        steps={asIsSteps}
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
        copyMessage={copyMessage}
        copyError={copyError}
        onChange={onStepChange}
        onAdd={onAddStep}
        onCancel={onCancelEdit}
        onCopy={onCopySteps}
      />
      <ToBeStepsList
        steps={steps}
        findings={findings}
        editingId={editingStepId}
        error={toBeError}
        onEdit={onEditStep}
        onDelete={onDeleteStep}
        onMove={onMoveStep}
      />
      <ToBeSummary steps={steps} selectedCount={selectedFindingIds.length} />

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
        <button className="back-button" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          Wróć do analizy
        </button>
        <button className="save-button" type="button" onClick={onSave}>
          Zapisz proces TO-BE
          <span aria-hidden="true">✓</span>
        </button>
        {saved && assumptions.changeGoal.trim() && steps.length > 0 && (
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

function ProcessReportSummary({ scope, startMethod, asIsSteps, findings, toBeSteps }) {
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
    <section className="report-section report-overview" aria-labelledby="report-summary-title">
      <ReportSectionTitle
        number="01"
        title="Podsumowanie procesu"
        description="Najważniejsze informacje z całego przeprowadzonego procesu."
      />
      <div className="report-summary-grid" id="report-summary-title">
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
  const findingName = (id) => findings.find((item) => item.id === id)?.name

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
              {toBe && step.findingId && findingName(step.findingId) && (
                <span><small>Powiązane usprawnienie</small>{findingName(step.findingId)}</span>
              )}
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

function ProcessComparison({ startMethod, asIsSteps, toBeSteps, selectedCount }) {
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

function ProcessMapSection({ scope, startMethod, asIsSteps, toBeSteps, findings }) {
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
}) {
  return (
    <section className="report-section stakeholder-section">
      <ReportSectionTitle
        number="07"
        title="Interesariusze procesu"
        description="Osoby, role i zespoły zaangażowane w realizację oraz wynik procesu."
      />
      <div className="finding-form-panel stakeholder-form">
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
      </div>
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
            <div className="finding-actions">
              <button type="button" onClick={() => onEdit(item)}>✎ Edytuj</button>
              <button className="delete-finding" type="button" onClick={() => onDelete(item.id)}>× Usuń</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function RaciSection({ steps, stakeholders, raci, errors, onChange }) {
  const options = [
    ['', '—'],
    ['R', 'R'],
    ['A', 'A'],
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
                  <tr>
                    <th><span>{index + 1}</span>{step.name}</th>
                    {stakeholders.map((item) => {
                      const value = raci[step.id]?.[item.id] ?? ''
                      return (
                        <td key={item.id}>
                          <select
                            className={`raci-select raci-${value.toLowerCase()}`}
                            value={value}
                            onChange={(event) => onChange(step.id, item.id, event.target.value)}
                            aria-label={`${step.name}: ${item.name}`}
                          >
                            {options.map(([optionValue, label]) => <option value={optionValue} key={optionValue || 'none'}>{label}</option>)}
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                  {errors[step.id]?.length > 0 && (
                    <tr className="raci-error-row">
                      <td colSpan={stakeholders.length + 1}>
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

function Recommendations({ findings, toBeSteps, selectedFindingIds }) {
  const groups = [
    ['Kroki możliwe do automatyzacji', toBeSteps.filter((step) => step.automatable === 'Tak').map((step) => step.name), 'Nie wskazano kroków możliwych do automatyzacji'],
    ['Ustalenia o wysokim wpływie', findings.filter((item) => item.impactLevel === 'Wysoki').map((item) => item.name), 'Nie zidentyfikowano ustaleń o wysokim wpływie'],
    ['Wąskie gardła', findings.filter((item) => item.category === 'Wąskie gardło').map((item) => item.name), 'Nie zidentyfikowano wąskich gardeł'],
    ['Ryzyka', findings.filter((item) => item.category === 'Ryzyko lub możliwość błędu').map((item) => item.name), 'Nie zidentyfikowano ryzyk'],
    ['Niejasne odpowiedzialności', findings.filter((item) => item.category === 'Niejasna odpowiedzialność').map((item) => item.name), 'Nie zidentyfikowano niejasnych odpowiedzialności'],
    ['Ustalenia nieuwzględnione w TO-BE', findings.filter((item) => !selectedFindingIds.includes(item.id)).map((item) => item.name), 'Wszystkie ustalenia uwzględniono w TO-BE'],
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

function ReportScreen({
  scope,
  startMethod,
  asIsDescription,
  asIsSteps,
  findings,
  toBeAssumptions,
  selectedFindingIds,
  toBeSteps,
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
}) {
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
      <ProcessComparison startMethod={startMethod} asIsSteps={asIsSteps} toBeSteps={toBeSteps} selectedCount={selectedFindingIds.length} />
      <ProcessMapSection
        scope={scope}
        startMethod={startMethod}
        asIsSteps={asIsSteps}
        toBeSteps={toBeSteps}
        findings={findings}
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
      />
      <RaciSection steps={toBeSteps} stakeholders={stakeholders} raci={raci} errors={raciErrors} onChange={onRaciChange} />
      <Recommendations findings={findings} toBeSteps={toBeSteps} selectedFindingIds={selectedFindingIds} />
      {reportError && <div className="save-message storage-error" role="alert"><span aria-hidden="true">!</span><div><strong>{reportError}</strong><small>Uzupełnij wymagane dane raportu.</small></div></div>}
      {saved && <div className="save-message success-message" role="status"><span aria-hidden="true">✓</span><div><strong>Raport procesu został zapisany</strong><small>Interesariusze i macierz RACI są zapisane lokalnie.</small></div></div>}
      {saveError && <div className="save-message storage-error" role="alert"><span aria-hidden="true">!</span><div><strong>Nie udało się zapisać raportu</strong><small>Sprawdź ustawienia przeglądarki i spróbuj ponownie.</small></div></div>}
      <div className="form-actions">
        <button className="back-button" type="button" onClick={onBack}><span aria-hidden="true">←</span>Wróć do TO-BE</button>
        <button className="save-button" type="button" onClick={onSave}>Zapisz raport<span aria-hidden="true">✓</span></button>
      </div>
    </section>
  )
}

function App() {
  const [savedScope] = useState(loadSavedScope)
  const [savedAsIs] = useState(loadSavedAsIs)
  const [savedAnalysis] = useState(loadSavedAnalysis)
  const [savedToBe] = useState(loadSavedToBe)
  const [savedReport] = useState(loadSavedReport)
  const [screen, setScreen] = useState('start')
  const [startMethod, setStartMethod] = useState(savedScope.startMethod)
  const [formData, setFormData] = useState(savedScope.data)
  const [errors, setErrors] = useState({})
  const [scopeSaveError, setScopeSaveError] = useState(false)
  const [asIsDescription, setAsIsDescription] = useState(savedAsIs.description)
  const [steps, setSteps] = useState(savedAsIs.steps)
  const [stepDraft, setStepDraft] = useState(emptyStep)
  const [editingStepId, setEditingStepId] = useState(null)
  const [descriptionError, setDescriptionError] = useState('')
  const [stepError, setStepError] = useState('')
  const [asIsError, setAsIsError] = useState('')
  const [asIsSaved, setAsIsSaved] = useState(savedAsIs.isSaved)
  const [asIsSaveError, setAsIsSaveError] = useState(false)
  const [findings, setFindings] = useState(savedAnalysis.findings)
  const [findingDraft, setFindingDraft] = useState(emptyFinding)
  const [editingFindingId, setEditingFindingId] = useState(null)
  const [findingErrors, setFindingErrors] = useState({})
  const [analysisError, setAnalysisError] = useState('')
  const [analysisSaved, setAnalysisSaved] = useState(savedAnalysis.isSaved)
  const [analysisSaveError, setAnalysisSaveError] = useState(false)
  const [toBeAssumptions, setToBeAssumptions] = useState(savedToBe.assumptions)
  const [selectedFindingIds, setSelectedFindingIds] = useState(
    (
      savedToBe.selectedFindingIds ??
      savedAnalysis.findings.map((finding) => finding.id)
    ).filter((id) =>
      savedAnalysis.findings.some((finding) => finding.id === id),
    ),
  )
  const [toBeSteps, setToBeSteps] = useState(savedToBe.steps)
  const [toBeStepDraft, setToBeStepDraft] = useState(emptyToBeStep)
  const [editingToBeStepId, setEditingToBeStepId] = useState(null)
  const [toBeAssumptionError, setToBeAssumptionError] = useState('')
  const [toBeStepError, setToBeStepError] = useState('')
  const [toBeError, setToBeError] = useState('')
  const [toBeSaved, setToBeSaved] = useState(savedToBe.isSaved)
  const [toBeSaveError, setToBeSaveError] = useState(false)
  const [copiedFromAsIs, setCopiedFromAsIs] = useState(savedToBe.copiedFromAsIs)
  const [copyMessage, setCopyMessage] = useState('')
  const [copyError, setCopyError] = useState('')
  const suggestedStakeholders = buildSuggestedStakeholders(
    savedScope.data,
    savedAsIs.steps,
    savedToBe.steps,
  )
  const [stakeholders, setStakeholders] = useState(
    savedReport.initialized || savedReport.stakeholders.length > 0
      ? savedReport.stakeholders
      : suggestedStakeholders,
  )
  const [stakeholderDraft, setStakeholderDraft] = useState(emptyStakeholder)
  const [editingStakeholderId, setEditingStakeholderId] = useState(null)
  const [stakeholderError, setStakeholderError] = useState('')
  const [raci, setRaci] = useState(savedReport.raci)
  const [raciErrors, setRaciErrors] = useState({})
  const [reportError, setReportError] = useState('')
  const [reportSaved, setReportSaved] = useState(savedReport.isSaved)
  const [reportSaveError, setReportSaveError] = useState(false)

  const showStart = () => {
    setScreen('start')
    setScopeSaveError(false)
    setAsIsSaveError(false)
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

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          data: formData,
          startMethod,
          savedAt: new Date().toISOString(),
        }),
      )
      setScreen('as-is')
      setAsIsSaveError(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
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
      stepName: 'name',
      stepDescription: 'description',
      stepOwner: 'owner',
      stepSystem: 'system',
      stepResult: 'result',
    }
    const field = fieldMap[event.target.name]
    setStepDraft((currentStep) => ({ ...currentStep, [field]: event.target.value }))
    if (field === 'name') {
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

  const addOrUpdateStep = () => {
    if (!stepDraft.name.trim()) {
      setStepError('Uzupełnij nazwę kroku.')
      document.getElementById('stepName')?.focus()
      return
    }

    if (editingStepId) {
      setSteps((currentSteps) =>
        currentSteps.map((step) =>
          step.id === editingStepId ? { ...stepDraft, id: editingStepId } : step,
        ),
      )
    } else {
      const id =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`
      setSteps((currentSteps) => [...currentSteps, { ...stepDraft, id }])
    }

    setStepDraft(emptyStep)
    setEditingStepId(null)
    setStepError('')
    setAsIsError('')
    setAsIsSaved(false)
  }

  const editStep = (step) => {
    setStepDraft({
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
    setSteps((currentSteps) => currentSteps.filter((step) => step.id !== stepId))
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
    setAsIsSaved(false)
    setAsIsSaveError(false)
    setAsIsError('')

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
      localStorage.setItem(
        AS_IS_STORAGE_KEY,
        JSON.stringify({
          description: asIsDescription,
          steps,
          startMethod,
          savedAt: new Date().toISOString(),
        }),
      )
      setAsIsSaved(true)
    } catch {
      setAsIsSaveError(true)
    }
  }

  const continueToAnalysis = () => {
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

    if (findings.length === 0) {
      setAnalysisError('Dodaj co najmniej jedno ustalenie analityczne.')
      return
    }

    try {
      localStorage.setItem(
        ANALYSIS_STORAGE_KEY,
        JSON.stringify({
          findings,
          startMethod,
          savedAt: new Date().toISOString(),
        }),
      )
      setAnalysisSaved(true)
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
    if (!analysisSaved || findings.length === 0) {
      setAnalysisError('Dodaj i zapisz co najmniej jedno ustalenie analityczne.')
      return
    }
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
      toBeStepName: 'name',
      toBeStepDescription: 'description',
      toBeStepOwner: 'owner',
      toBeStepSystem: 'system',
      toBeStepResult: 'result',
      toBeStepType: 'stepType',
      toBeStepFinding: 'findingId',
      toBeStepAutomatable: 'automatable',
    }
    const field = fieldMap[event.target.name]
    setToBeStepDraft((current) => ({ ...current, [field]: event.target.value }))
    if (field === 'name') {
      setToBeStepError('')
    }
    setToBeSaved(false)
    setToBeSaveError(false)
    setCopyMessage('')
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

    if (editingToBeStepId) {
      setToBeSteps((currentSteps) =>
        currentSteps.map((step) =>
          step.id === editingToBeStepId
            ? { ...toBeStepDraft, id: editingToBeStepId }
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
      name: step.name,
      description: step.description,
      owner: step.owner,
      system: step.system,
      result: step.result,
      stepType: step.stepType,
      findingId: step.findingId,
      automatable: step.automatable,
    })
    setEditingToBeStepId(step.id)
    setToBeStepError('')
    document.getElementById('toBeStepName')?.focus()
  }

  const deleteToBeStep = (stepId) => {
    setToBeSteps((currentSteps) =>
      currentSteps.filter((step) => step.id !== stepId),
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

  const copyAsIsSteps = () => {
    setCopyMessage('')
    setCopyError('')

    if (toBeSteps.length > 0) {
      setCopyError(
        'Lista TO-BE zawiera już kroki. Usuń je, jeśli chcesz rozpocząć od ponownego kopiowania.',
      )
      return
    }
    if (steps.length === 0) {
      setCopyError('Brak kroków AS-IS do skopiowania.')
      return
    }

    const copiedSteps = steps.map((step, index) => ({
      ...emptyToBeStep,
      name: step.name,
      description: step.description,
      owner: step.owner,
      system: step.system,
      result: step.result,
      stepType: 'Bez zmian',
      id: `as-is-copy-${step.id}-${index}`,
    }))
    setToBeSteps(copiedSteps)
    setCopiedFromAsIs(true)
    setCopyMessage('copied')
    setToBeError('')
    setToBeSaved(false)
  }

  const saveToBe = () => {
    setToBeSaved(false)
    setToBeSaveError(false)

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
      localStorage.setItem(
        TO_BE_STORAGE_KEY,
        JSON.stringify({
          assumptions: toBeAssumptions,
          selectedFindingIds,
          steps: toBeSteps,
          copiedFromAsIs,
          savedAt: new Date().toISOString(),
        }),
      )
      setToBeSaved(true)
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

  const saveReport = () => {
    setReportError('')
    setReportSaved(false)
    setReportSaveError(false)

    if (stakeholders.length === 0) {
      setReportError('Dodaj co najmniej jednego interesariusza.')
      return
    }

    const validationErrors = {}
    toBeSteps.forEach((step) => {
      const assignments = Object.values(raci[step.id] ?? {})
      const messages = []
      const responsibleCount = assignments.filter((value) => value === 'R').length
      const accountableCount = assignments.filter((value) => value === 'A').length
      if (responsibleCount === 0) {
        messages.push('Krok musi mieć przynajmniej jedną rolę Responsible (R).')
      }
      if (accountableCount === 0) {
        messages.push('Krok musi mieć dokładnie jedną rolę Accountable (A).')
      } else if (accountableCount > 1) {
        messages.push('Krok powinien mieć tylko jedną rolę Accountable (A).')
      }
      if (messages.length) validationErrors[step.id] = messages
    })
    setRaciErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      setReportError('Uzupełnij poprawnie macierz RACI dla wszystkich kroków.')
      return
    }

    try {
      localStorage.setItem(
        REPORT_STORAGE_KEY,
        JSON.stringify({
          stakeholders,
          raci,
          initialized: true,
          savedAt: new Date().toISOString(),
        }),
      )
      setReportSaved(true)
    } catch {
      setReportSaveError(true)
    }
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

  return (
    <div className="app-shell">
      <AppHeader onHome={showStart} />
      <main>
        <ProcessProgress activeStage={activeStage} />
        {screen === 'start' ? (
          <StartScreen onStart={startScope} />
        ) : screen === 'scope' ? (
          <ScopeForm
            formData={formData}
            errors={errors}
            startMethod={startMethod}
            saved={false}
            saveError={scopeSaveError}
            onBack={showStart}
            onChange={handleScopeChange}
            onSubmit={handleScopeSubmit}
          />
        ) : screen === 'as-is' ? (
          <AsIsScreen
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
            onBack={showScope}
            onSave={saveAsIs}
            onContinue={continueToAnalysis}
          />
        ) : screen === 'analysis' ? (
          <AnalysisScreen
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
            onAddStep={addOrUpdateToBeStep}
            onEditStep={editToBeStep}
            onDeleteStep={deleteToBeStep}
            onMoveStep={moveToBeStep}
            onCancelEdit={cancelToBeStepEdit}
            onCopySteps={copyAsIsSteps}
            onBack={showAnalysis}
            onSave={saveToBe}
            onContinue={continueToReport}
          />
        ) : (
          <ReportScreen
            scope={formData}
            startMethod={startMethod}
            asIsDescription={asIsDescription}
            asIsSteps={steps}
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
