import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IMPORT_MAX_BYTES, IMPORT_MESSAGES, PASSPHRASE_MIN_LENGTH } from '@application/usecases';
import type { ImportResult } from '@application/usecases';
import { useDependencies } from '../../app/dependencies';
import { useAppState } from '../../app/appState';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Field } from '../../components/Field';
import { Notice } from '../../components/Notice';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { Toggle } from '../../components/Toggle';
import { applyTheme } from '../../hooks/theme';
import styles from './DataSection.module.css';

type ImportError = Exclude<ImportResult, { readonly status: 'imported' }>;

export const FORGOTTEN_PASSPHRASE_WARNING =
  'Phrase oubliée = sauvegarde irrécupérable. Personne ne pourra l’ouvrir, pas même nous.';

/** Mot à saisir pour confirmer « Tout effacer ». */
export const WIPE_CONFIRMATION_WORD = 'EFFACER';

function readFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Lecture impossible'));
    };
    reader.readAsText(file);
  });
}

/** « Mes données » : sauvegarde (claire ou chiffrée), restauration, effacement. */
export function DataSection() {
  const { exportData, importData, wipeAllData, getSettings } = useDependencies();
  const { setProfileStatus } = useAppState();
  const navigate = useNavigate();
  const toast = useToast();

  // Export
  const [encrypt, setEncrypt] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [exportError, setExportError] = useState<string | undefined>();
  const [exporting, setExporting] = useState(false);

  // Import
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ name: string; content: string } | undefined>();
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importError, setImportError] = useState<ImportError | undefined>();
  const [importing, setImporting] = useState(false);

  // Effacement
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeWord, setWipeWord] = useState('');

  const doExport = async () => {
    setExportError(undefined);
    if (encrypt && passphrase.length < PASSPHRASE_MIN_LENGTH) {
      setExportError(`Choisis une phrase secrète d’au moins ${PASSPHRASE_MIN_LENGTH} caractères.`);
      return;
    }
    setExporting(true);
    try {
      const result = await exportData(encrypt ? { passphrase } : {});
      if (result.status === 'passphrase-too-short') {
        setExportError(result.message);
        return;
      }
      if (result.status === 'failed') {
        toast.show(result.message, 'error');
        return;
      }
      setPassphrase('');
      toast.show(`Sauvegarde enregistrée : ${result.fileName}`, 'success');
    } catch {
      toast.show('La sauvegarde n’a pas pu être créée.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const closeImport = () => {
    setPendingFile(undefined);
    setNeedsPassphrase(false);
    setImportPassphrase('');
    setImportError(undefined);
    if (fileInput.current) fileInput.current.value = '';
  };

  const doImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    setImportError(undefined);
    try {
      const result = await importData({
        content: pendingFile.content,
        ...(needsPassphrase ? { passphrase: importPassphrase } : {}),
      });
      if (result.status === 'imported') {
        closeImport();
        const settings = await getSettings();
        applyTheme(settings.theme);
        toast.show('Tes données sont restaurées. Bon retour !', 'success');
        setProfileStatus(result.counts.profile ? 'ready' : 'none');
        navigate(result.counts.profile ? '/semaine' : '/bienvenue');
        return;
      }
      if (result.status === 'passphrase-required') {
        setNeedsPassphrase(true);
        return;
      }
      setImportError(result);
    } catch {
      setImportError({
        status: 'invalid',
        message: 'La restauration a échoué. Tes données actuelles sont intactes.',
      });
    } finally {
      setImporting(false);
    }
  };

  const doWipe = async () => {
    const result = await wipeAllData();
    setWipeOpen(false);
    if (result.status === 'failed') {
      toast.show(result.message, 'error');
      return;
    }
    applyTheme('system');
    toast.show('Tout est effacé. À bientôt !');
    setProfileStatus('none');
    navigate('/bienvenue', { replace: true });
  };

  return (
    <Card as="section" id="mes-donnees" aria-labelledby="data-title" className={styles.card}>
      <h2 id="data-title">
        <span aria-hidden="true">💾 </span>Mes données
      </h2>
      <p className={styles.intro}>
        Elles restent sur ce téléphone. Une sauvegarde te permet de les retrouver ailleurs.
      </p>

      <div className={styles.block}>
        <h3>Sauvegarder</h3>
        <Toggle
          label="Protéger par une phrase secrète"
          hint="Le fichier sera chiffré."
          checked={encrypt}
          onChange={(value) => {
            setEncrypt(value);
            setExportError(undefined);
          }}
        />
        {encrypt && (
          <>
            <Field
              label="Phrase secrète"
              type="password"
              autoComplete="new-password"
              hint={`Au moins ${PASSPHRASE_MIN_LENGTH} caractères.`}
              value={passphrase}
              error={exportError}
              onChange={(e) => {
                setPassphrase(e.target.value);
              }}
            />
            <Notice tone="warning" emoji="⚠️">
              {FORGOTTEN_PASSPHRASE_WARNING}
            </Notice>
          </>
        )}
        {!encrypt && exportError && <p className={styles.error}>{exportError}</p>}
        <Button
          icon="⬇️"
          disabled={exporting}
          onClick={() => {
            void doExport();
          }}
        >
          Exporter mes données
        </Button>
      </div>

      <div className={styles.block}>
        <h3>Restaurer</h3>
        <p className={styles.hint}>Remplace toutes tes données par celles d’une sauvegarde.</p>
        <input
          ref={fileInput}
          id="import-file"
          type="file"
          accept=".json,.nutry,application/json"
          className="visually-hidden"
          aria-label="Choisir une sauvegarde à importer"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            // Vérifié avant la lecture : un fichier énorme ne bloque pas le téléphone.
            if (file.size > IMPORT_MAX_BYTES) {
              toast.show(IMPORT_MESSAGES['too-large'], 'error');
              event.target.value = '';
              return;
            }
            void readFile(file).then(
              (content) => {
                setPendingFile({ name: file.name, content });
              },
              () => {
                toast.show('Impossible de lire ce fichier.', 'error');
              },
            );
          }}
        />
        <Button
          variant="secondary"
          icon="⬆️"
          onClick={() => {
            fileInput.current?.click();
          }}
        >
          Importer une sauvegarde
        </Button>
      </div>

      <div className={styles.block}>
        <h3>Confidentialité</h3>
        <Link to="/confidentialite" className={styles.link}>
          Comment tes données sont protégées
        </Link>
      </div>

      <div className={`${styles.block} ${styles.danger}`}>
        <h3>Tout effacer</h3>
        <p className={styles.hint}>
          Profil, menus, avis, progrès : tout disparaît de ce téléphone.
        </p>
        <Button
          variant="danger"
          icon="🗑"
          onClick={() => {
            setWipeWord('');
            setWipeOpen(true);
          }}
        >
          Tout effacer
        </Button>
      </div>

      <Sheet
        open={pendingFile !== undefined}
        variant="dialog"
        role="alertdialog"
        title={needsPassphrase ? 'Sauvegarde protégée' : 'Remplacer toutes tes données ?'}
        description={
          needsPassphrase
            ? 'Saisis la phrase secrète choisie lors de la sauvegarde.'
            : `Le contenu de « ${pendingFile?.name ?? ''} » remplacera tout ce qui est sur ce téléphone.`
        }
        onClose={closeImport}
        footer={
          <>
            <Button variant="ghost" onClick={closeImport}>
              Annuler
            </Button>
            <Button
              disabled={importing || (needsPassphrase && importPassphrase === '')}
              onClick={() => {
                void doImport();
              }}
            >
              {needsPassphrase ? 'Ouvrir la sauvegarde' : 'Oui, remplacer'}
            </Button>
          </>
        }
      >
        <form
          className={styles.dialogBody}
          onSubmit={(event) => {
            event.preventDefault();
            void doImport();
          }}
        >
          {needsPassphrase && (
            <Field
              label="Phrase secrète de la sauvegarde"
              type="password"
              autoComplete="current-password"
              value={importPassphrase}
              onChange={(e) => {
                setImportPassphrase(e.target.value);
              }}
            />
          )}
          {importError && (
            <div role="alert">
              <Notice tone="danger" emoji="😕">
                {importError.message}
                {importError.errors && importError.errors.length > 0 && (
                  <details className={styles.errors}>
                    <summary>Détails</summary>
                    <ul>
                      {importError.errors.slice(0, 10).map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </Notice>
            </div>
          )}
          {!needsPassphrase && !importError && (
            <p className={styles.hint}>Pense à exporter tes données actuelles avant, si besoin.</p>
          )}
        </form>
      </Sheet>

      <Sheet
        open={wipeOpen}
        variant="dialog"
        role="alertdialog"
        title="Tout effacer ?"
        description="C’est définitif : sans sauvegarde, rien ne pourra être récupéré."
        onClose={() => {
          setWipeOpen(false);
        }}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setWipeOpen(false);
              }}
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={wipeWord.trim().toUpperCase() !== WIPE_CONFIRMATION_WORD}
              onClick={() => {
                void doWipe();
              }}
            >
              Effacer définitivement
            </Button>
          </>
        }
      >
        <Field
          label={`Pour confirmer, écris ${WIPE_CONFIRMATION_WORD}`}
          autoComplete="off"
          value={wipeWord}
          onChange={(e) => {
            setWipeWord(e.target.value);
          }}
        />
      </Sheet>
    </Card>
  );
}
