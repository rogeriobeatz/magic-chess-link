import { chooseComputerAction, type ComputerRequest, type ComputerResponse } from "./computer";

self.onmessage = (event: MessageEvent<ComputerRequest>) => {
  let response: ComputerResponse;
  try {
    response = { action: chooseComputerAction(event.data.state, event.data.difficulty) };
  } catch {
    response = { action: null, error: "Não foi possível calcular a jogada do computador." };
  }
  self.postMessage(response);
};
