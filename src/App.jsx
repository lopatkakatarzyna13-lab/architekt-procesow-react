import './App.css'

const stages = ['Zakres', 'AS-IS', 'Analiza', 'TO-BE', 'Raport']

function CompassIcon() {
  return (
    <span className="compass-icon" aria-hidden="true">
      <span />
    </span>
  )
}

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Architekt Procesów — strona główna">
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

      <main>
        <nav className="progress" aria-label="Etapy projektowania procesu">
          <ol>
            {stages.map((stage, index) => (
              <li
                className={index === 0 ? 'active' : ''}
                key={stage}
                aria-current={index === 0 ? 'step' : undefined}
              >
                <span className="stage-number">{index + 1}</span>
                <span className="stage-label">{stage}</span>
              </li>
            ))}
          </ol>
        </nav>

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
              <button className="path-card path-card-primary" type="button">
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

              <button className="path-card" type="button">
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
      </main>

      <footer>
        <span>Twój proces jest zapisywany lokalnie</span>
        <span>Architekt Procesów · Wersja robocza</span>
      </footer>
    </div>
  )
}

export default App
