import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quizzesRouter from "./quizzes";
import questionsRouter from "./questions";
import quizAttemptsRouter from "./quiz-attempts";
import userProgressRouter from "./user-progress";
import categoriesRouter from "./categories";
import meRouter from "./me";
import newsletterRouter from "./newsletter";
import dailyQuizRouter from "./daily-quiz";
import coursesRouter from "./courses";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(newsletterRouter);
router.use(dailyQuizRouter);
router.use(categoriesRouter);
router.use(coursesRouter);
router.use(quizzesRouter);
router.use(questionsRouter);
router.use(quizAttemptsRouter);
router.use(userProgressRouter);

export default router;
