import React from "react";
import { renderToString } from "react-dom/server";
import { PanelLeft } from "lucide-react";

console.log(renderToString(<PanelLeft fill="currentColor" />));
