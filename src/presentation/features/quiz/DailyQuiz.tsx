import { useEffect, useRef, useState } from 'react';
import type { DailyQuizView, QuizAnswerView } from '@application/usecases';
import { useDependencies } from '../../app/dependencies';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { QUIZ_CATEGORY_LABELS, plural } from '../../i18n/labels';
import styles from './DailyQuiz.module.css';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Carte « question du jour » : à l'ouverture de l'app, une fois par session de
 * navigateur (pas à chaque changement d'onglet). Fermable par ✕, Échap ou glissement.
 */
export function DailyQuiz() {
  const { getDailyQuiz, answerQuiz, claimDailyQuizForSession } = useDependencies();
  const [quiz, setQuiz] = useState<DailyQuizView | undefined>();
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
    if (!claimDailyQuizForSession()) return;
    void getDailyQuiz().then((view) => {
      if (!mounted.current || !view) return;
      setQuiz(view);
      setAnswer(view.answer);
      setOpen(true);
    });
  }, [getDailyQuiz, claimDailyQuizForSession]);

  if (!quiz) return null;

  const choose = async (index: number) => {
    if (answer || pending) return;
    setPending(true);
    try {
      const result = await answerQuiz({ questionId: quiz.questionId, answerIndex: index });
      if (result) setAnswer(result);
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
          <span aria-hidden="true">💡 </span>La question du jour
        </>
      }
      closeLabel="Fermer la question du jour"
      footer={
        answer ? (
          <Button onClick={close} block>
            Voir mon menu
          </Button>
        ) : undefined
      }
    >
      <div className={styles.quiz}>
        <Badge tone="accent">{QUIZ_CATEGORY_LABELS[quiz.category]}</Badge>
        <p className={styles.question}>{quiz.question}</p>
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
                  : 'Nouvelle série demain !'}
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
