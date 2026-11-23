import { useEffect, useRef, useState } from 'react';
import type { QuizAnswerView, QuizView } from '@application/usecases';
import { useDependencies } from '../../app/dependencies';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { useCelebrationCheck } from '../companion/Celebration';
import { Nutry } from '../companion/Nutry';
import { useCompanion } from '../companion/useCompanion';
import { QUIZ_CATEGORY_LABELS, plural } from '../../i18n/labels';
import styles from './QuizCard.module.css';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Carte « question du moment » : une nouvelle question à chaque ouverture de l'app, la
 * carte s'ouvrant une fois par session (pas à chaque changement d'onglet ni rechargement).
 * Fermable par ✕, Échap ou glissement ; fermée sans réponse, la question pourra revenir.
 */
export function QuizCard() {
  const { getQuiz, answerQuiz, claimQuizForSession } = useDependencies();
  const checkCelebration = useCelebrationCheck();
  const { companion } = useCompanion();
  const [quiz, setQuiz] = useState<QuizView | undefined>();
  const [answer, setAnswer] = useState<QuizAnswerView | undefined>();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Marqué avant la réponse : le double effet du mode strict ne la redemande pas.
    if (!claimQuizForSession()) return;
    void getQuiz().then((view) => {
      if (!mounted.current || !view) return;
      setQuiz(view);
      setAnswer(view.answer);
      setOpen(true);
    });
  }, [getQuiz, claimQuizForSession]);

  if (!quiz) return null;

  const choose = async (index: number) => {
    if (answer || pending) return;
    setPending(true);
    try {
      const result = await answerQuiz({ questionId: quiz.questionId, answerIndex: index });
      if (result) {
        setAnswer(result);
        checkCelebration();
      }
    } finally {
      setPending(false);
    }
  };

  const close = () => {
    setOpen(false);
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={
        <>
          <span aria-hidden="true">💡 </span>La question du moment
        </>
      }
      closeLabel="Fermer la question du moment"
      footer={
        answer ? (
          <Button onClick={close} block>
            Voir mon menu
          </Button>
        ) : undefined
      }
    >
      <div className={styles.quiz}>
        <div className={styles.ask}>
          {companion && <Nutry look={companion.look} mood={companion.mood} size="s" />}
          <div className={styles.bubble}>
            <Badge tone="accent">{QUIZ_CATEGORY_LABELS[quiz.category]}</Badge>
            <p className={styles.question}>{quiz.question}</p>
          </div>
        </div>
        <ul className={styles.choices}>
          {quiz.choices.map((choice, index) => {
            const isCorrect = answer?.correctIndex === index;
            const isChosen = answer?.answerIndex === index;
            const state = answer
              ? isCorrect
                ? styles.correct
                : isChosen
                  ? styles.wrong
                  : styles.dimmed
              : '';
            return (
              <li key={choice}>
                <button
                  type="button"
                  className={`${styles.choice} ${state}`}
                  disabled={answer !== undefined || pending}
                  aria-describedby={answer && isCorrect ? 'quiz-result' : undefined}
                  onClick={() => {
                    void choose(index);
                  }}
                >
                  <span className={styles.letter} aria-hidden="true">
                    {LETTERS[index]}
                  </span>
                  <span className={styles.choiceText}>{choice}</span>
                  {answer && isCorrect && <span className={styles.mark}>✓ Bonne réponse</span>}
                  {answer && isChosen && !isCorrect && (
                    <span className={styles.mark}>Ta réponse</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div aria-live="polite">
          {answer && (
            <div id="quiz-result" className={styles.result}>
              <p className={styles.verdict}>
                <span aria-hidden="true">{answer.correct ? '🎉 ' : '🌱 '}</span>
                {answer.message}
              </p>
              <p>{answer.explanation}</p>
              <p className={styles.streak}>
                <span aria-hidden="true">🔥 </span>
                {answer.streak > 0
                  ? `Série : ${plural(answer.streak, 'bonne réponse', 'bonnes réponses')}`
                  : 'Nouvelle série à la prochaine question !'}
                {answer.bestStreak > 0 && (
                  <span className={styles.best}> · record : {answer.bestStreak}</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
