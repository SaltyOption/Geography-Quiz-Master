import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quizzesRouter from "./quizzes";
import questionsRouter from "./questions";
import quizAttemptsRouter from "./quiz-attempts";
import userProgressRouter from "./user-progress";

const router: IRouter = Router();

router.use(healthRouter);
router.use(quizzesRouter);
router.use(questionsRouter);
router.use(quizAttemptsRouter);
router.use(userProgressRouter);

export default router;
