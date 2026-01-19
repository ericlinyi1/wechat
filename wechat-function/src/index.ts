import { app } from "@azure/functions";

// 可选：你的 setup
app.setup({ enableHttpStream: true });

// 关键：加载并执行所有函数注册
import "./functions/listModels";
import "./functions/httpTrigger";
