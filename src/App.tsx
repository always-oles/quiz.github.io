import { useState, useRef, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { FaMale } from 'react-icons/fa';
import { FaFemale } from 'react-icons/fa';
import { FaCar } from 'react-icons/fa';
import { MdPedalBike } from 'react-icons/md';
import { IoIosArrowRoundBack } from 'react-icons/io';
import { useIsMount } from './useIsMount';
import './index.css';

interface QuestionBlock {
  id: number;
  question: string;
  type: 'select-sex' | 'single-variant' | 'custom-input' | 'select-vehicle-type';
  options?: Array<string | boolean>;
  additionalOptions?: AdditionalOptions;
  conditionalBlocks?: ConditionalBlock;
}

interface AdditionalOptions {
  hideNextButton?: boolean;
}

interface ConditionalBlock {
  [key: string]: QuestionBlock[];
}

interface FormData {
  [key: string]: any;
}

const App: React.FC = () => {
  const lastStep = useRef();
  const isMount = useIsMount();
  const [steps, setSteps] = useState<QuestionBlock[]>([]);
  const [isNextDisabled, setIsNextDisabled] = useState<Boolean>(true);

  const [nesting, setNesting] = useState({});
  const [formData, setFormData] = useState<FormData>({});

  const [questionsCount, setQuestionsCount] = useState(0);
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1);
  const [currentStep, setCurrentStep] = useState<QuestionBlock | null>(null);
  const [currentStepNumber, setCurrentStepNumber] = useState(0);

  const [history, setHistory] = useState([]);
  const [stepStartTime, setStepStartTime] = useState<Date>(new Date());

  const { register, handleSubmit, setValue, getValues, reset, watch, formState } = useForm<FormData>();

  function findElementById(elements, id) {
    // Base case: Loop through the main array of elements
    for (const element of elements) {
      // Check if the current element has the matching id
      if (element.id === +id) {
        return element;
      }

      // Recursively check the 'conditionalBlocks' if it exists
      if (element.conditionalBlocks) {
        for (const key in element.conditionalBlocks) {
          const found = findElementById(element.conditionalBlocks[key], id);
          if (found) {
            return found;
          }
        }
      }
    }

    // Return null if no matching element is found
    return null;
  }

  // Load initial data (JSON), form data, and time from localStorage if available
  useEffect(() => {
    fetch('./questions.json')
      .then((res) => res.json())
      .then((data) => {
        setSteps(data);
        setStepStartTime(new Date());
        loadAllData(data);
        lastStep.current = data[data.length - 1];
      });
  }, []);

  /**
   * Saves the state and data to localStorage
   */
  const saveAllData = () => {
    console.log('saving all data to localstorage');
    localStorage.setItem('nesting', JSON.stringify(nesting));
    localStorage.setItem('formData', JSON.stringify(formData));
    localStorage.setItem('questionsCount', JSON.stringify(questionsCount));
    localStorage.setItem('currentQuestionNumber', JSON.stringify(currentQuestionNumber));
    localStorage.setItem('currentStep', JSON.stringify(currentStep));
    localStorage.setItem('currentStepNumber', JSON.stringify(currentStepNumber));
    localStorage.setItem('history', JSON.stringify(history));
  };

  /**
   * Loads initial data (JSON), form data, and time from localStorage if available.
   * 
   * @param data The questions data.
   */
  const loadAllData = (data: []) => {
    const parsedNesting = JSON.parse(localStorage.getItem('nesting') || '{}');
    if (Object.keys(parsedNesting).length > 0) {
      setNesting(parsedNesting);  
    }
    calculateCount(data, parsedNesting);

    const parsedFormData = JSON.parse(localStorage.getItem('formData') || 'null');
    if (parsedFormData) {
      setFormData(parsedFormData);
    }

    const parsedCurrentQuestionNumber = JSON.parse(localStorage.getItem('currentQuestionNumber') || 'null');
    if (parsedCurrentQuestionNumber) {
      setCurrentQuestionNumber(parsedCurrentQuestionNumber);
    }
    
    const parsedCurrentStepNumber = JSON.parse(localStorage.getItem('currentStepNumber') || 'null');
    if (parsedCurrentStepNumber) {
      setCurrentStepNumber(parsedCurrentStepNumber);
    }
    
    const parsedHistory = JSON.parse(localStorage.getItem('history') || 'null');
    if (parsedHistory) {
      setHistory(parsedHistory);
    }

    const parsedCurrentStep = JSON.parse(localStorage.getItem('currentStep') || 'null');
    if (parsedCurrentStep) {
      setCurrentStep(parsedCurrentStep);
    } else {
      setCurrentStep(data[0]);
    }
  };

  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      // console.log(
      //   'watch! CHANGED',
      //   value,
      //   name,
      //   type,
      //   'currentStep',
      //   currentStep
      // );

      // no need for any action if it's a reset action
      if (Object.keys(value).length === 0) {
        return;
      }

      switch (currentStep.type) {
        case 'single-variant':
          setIsNextDisabled(false);
          break;
        case 'custom-input':
          if (value[name].length === 0) {
            setIsNextDisabled(true);
          } else {
            setIsNextDisabled(false);
          }
          break;
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, steps, currentStep]);

  const handleNextButton = (e: React.SyntheticEvent) => {
    e.preventDefault();
    handleStep();
  };

  useEffect(() => {
    console.log('history change----->', history, isMount);
    if (!isMount) {
      saveAllData();
    }
  }, [history]);

  useEffect(() => {
    console.log('nesting changed----->', nesting);
    calculateCount(steps, nesting);
  }, [Object.keys(nesting).length]);
  /**
   * Handles the nesting of questions. If the user goes back in history
   * and answers a question that has a conditional block, this function
   * will be called to update the current step and the nesting state.
   *
   * @returns true if the user should be taken to the next step, false otherwise.
   */
  const handleNesting = (formData) => {
    const parent = findElementById(steps, findLastActive(nesting).id);

    if (parent === null) {
      console.log('PARENT NOT FOUND');
      return false;
    }

    const answerValue = formData[parent.question];

    // if conditional questions number is more than we have nesting, we're done
    if (parent.conditionalBlocks[answerValue].length - 1 > nesting[parent.id].position) {
      let newNesting = nesting;
      newNesting[parent.id].position++;
      setNesting(newNesting);
      setCurrentStep(parent.conditionalBlocks[answerValue][newNesting[parent.id].position]);
    } else {
      let newNesting = nesting;
      newNesting[parent.id].active = false;
      setNesting(newNesting);
      if (hasActiveNesting(newNesting)) {
        handleNesting(formData);
      } else {
        goToNextStep();
      }
    }
  };

  /**
   * Finds the last active nesting object in the nesting state.
   *
   * @param data The nesting state.
   * @returns The last active nesting object, or null if none is found.
   */
  const findLastActive = (data: {}) => {
    const lastActive = Object.values(data).find((item) => item.active === true);
    return lastActive;
  };

  const hasActiveNesting = (data: {}) => {
    return Object.values(data).some((item) => item.active === true);
  };

  const calculateCount = (data, localNesting) => {
    let normalCount = data.length;
    let additionalCount = 0;

    if (Object.keys(localNesting).length > 0) {
      for (const i in localNesting) {
        let element = findElementById(data, localNesting[i].id);

        for (const j in formData) {
          if (j === element.question) {
            // console.log('adding ', element.conditionalBlocks[formData[j]].length);
            additionalCount += element.conditionalBlocks[formData[j]].length;
          }
        }
      }
    }

    setQuestionsCount(normalCount + additionalCount);
  };

  const calculateCurrent = (currentNumber: number, forward: boolean) => {
    let normalCount = currentNumber + 1;

    // if we are in the middle of a nesting, calculate the count based on nesting
    let additionalCount = 0;

    if (Object.keys(nesting).length > 0) {
      for (const i in nesting) {
        additionalCount++;
        // console.log('nesting additional current', nesting[i]);
        additionalCount += nesting[i].position;
      }
    }
    // console.log('mode:forward', forward, 'normal count, additional count', normalCount, additionalCount);

    setCurrentQuestionNumber(normalCount + additionalCount + 1);
  };

  const handleStep = function () {
    setIsNextDisabled(true);
    calculateCurrent(currentStepNumber, true);
    console.log('HANDLE STEP! CurrentStep:', currentStep);

    let savedFormData = { ...formData, ...getValues() };
    setFormData(savedFormData);

    // reset form, because we stored answers in formData
    reset();

    if (currentStep.id === lastStep.current.id) {
      alert('last step completed!');
      return;
    }

    // save history
    // TODO: save time spent and chosen option in currentstep
    setHistory((prevSteps) => [...prevSteps, currentStep]);

    if (hasActiveNesting(nesting)) {
      console.log('nesting detected', nesting);

      if (currentStep?.conditionalBlocks) {
        const block = currentStep.conditionalBlocks[savedFormData[currentStep.question]];

        if (block) {
          setCurrentStep(block[0]);
          setNesting((data) => ({
            ...data,
            [currentStep.id]: { id: currentStep.id, position: 0, active: true },
          }));
          return;
        }
      }

      handleNesting(savedFormData);
      return;
    }

    if (currentStep?.conditionalBlocks) {
      const block = currentStep.conditionalBlocks[savedFormData[currentStep.question]];

      if (block) {
        setCurrentStep(block[0]);
        setNesting((data) => ({
          ...data,
          [currentStep.id]: { id: currentStep.id, position: 0, active: true },
        }));
      } else {
        goToNextStep();
      }
    } else {
      goToNextStep();
    }
  };

  const goToNextStep = () => {
    const nextQuestionNumber = currentStepNumber + 1;
    setCurrentStepNumber(nextQuestionNumber);
    setCurrentStep(steps[nextQuestionNumber]);
    console.log('NNNext question');
  };

  const goBack = (e: React.SyntheticEvent) => {
    e.preventDefault();
    let currentNumber = currentStepNumber;
    let noDecrement = false;

    // take previous step from history
    const previousStep = history.slice(-1)[0];

    // reset form as we're going back in history
    reset();

    // Clear answer for the current question
    delete formData[currentStep.question];
    setFormData(formData);

    // previous question is on 0-level or is nested in conditional block
    let previousInNesting = true;
    for (const i in steps) {
      if (steps[i].id === previousStep.id) {
        previousInNesting = false;
        break;
      }
    }

    // if we're going back to question that has conditional blocks - remove it's nesting at all
    for (const i in nesting) {
      if (nesting[i].id === previousStep.id) {
        console.log('deleting nesting', nesting[i]);
        delete nesting[i];

        // we're going up in tree from nesting to general question
        noDecrement = true;
        break;
      }
    }
    console.log('going back in history, setting step', previousStep, 'nesting', nesting);
    console.log('previous in nesting', previousInNesting);

    // If nesting is present
    if (previousInNesting && Object.keys(nesting).length > 0) {
      console.log('back nesting detected!!!!!!!', nesting, 'Object.values(nesting)', Object.values(nesting));
      let lastEntry;

      // get last element of nesting
      for (const [key, value] of Object.entries(nesting)) {
        lastEntry = nesting[key];
      }

      console.log('LAST ENTRY', lastEntry);

      if (lastEntry.active === true) {
        if (lastEntry.position === 0) {
          delete nesting[lastEntry.id];
          let newLastEntry;

          ///////////////////////////////////////////////////////
          for (const [key, value] of Object.entries(nesting)) {
            newLastEntry = nesting[key];
          }
          if (newLastEntry.active === false) {
            newLastEntry.active = true;
          } else {
            newLastEntry.position -= 1;
          }
          nesting[newLastEntry.id] = newLastEntry;
          ////////////////////////////////////////////////////////
          console.log('deleting lastEntry:', lastEntry, 'new last entry', newLastEntry);
        } else {
          nesting[lastEntry.id].position -= 1;
          console.log('lastEntry decrement', lastEntry);
        }

        console.log('new nesting1', nesting);
        setNesting(nesting);
      } else {
        nesting[lastEntry.id].active = true;
        console.log('new nesting2', nesting);
        setNesting(nesting);
        currentNumber -= 1;
        setCurrentStepNumber(currentNumber);
      }
    } else if (noDecrement === false) {
      currentNumber -= 1;
      setCurrentStepNumber(currentNumber);
      console.log('CURRENT NUMBER DECREMENT', currentNumber);
    }

    // setting form value to previous step stored data
    setValue(previousStep.question, formData[previousStep.question]);
    setCurrentStep(previousStep);
    setHistory(history.slice(0, -1));
    calculateCurrent(currentNumber - 1, false);
  };

  return (
    <>
      <div className="header"></div>
      <div className="flex justify-center mt-6">
        {steps.length > 0 && (
          <>
            <form className="bg-white p-10 py-6 shadow-md w-full max-w-lg relative">
              <div className="flex justify-between w-full mb-10">
                <div className="inline w-16">
                  {history.length > 0 && (
                    <button
                      className="flex items-center px-2 bg-white text-gray-600 rounded-lg shadow hover:bg-gray-100 transition-colors"
                      onClick={goBack}
                    >
                      <IoIosArrowRoundBack /> Back
                    </button>
                  )}
                </div>
                <span className="text-lg -ml-20 text-gray-600 font-semibold">Goals</span>
                <span className="text-sm text-gray-600 font-semibold">
                  {currentQuestionNumber}/{questionsCount}
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress"
                  style={{
                    width: `${((currentQuestionNumber - 1) / (questionsCount - 1)) * 95}%`,
                    borderTopRightRadius: currentQuestionNumber === questionsCount ? '5px' : '0px',
                    borderBottomRightRadius: currentQuestionNumber === questionsCount ? '5px' : '0px',
                  }}
                ></div>
              </div>

              <h1 className="text-xl font-bold mb-4 mt-8 text-center question">{currentStep?.question}</h1>

              {currentStep?.type === 'custom-input' && (
                <input
                  {...register(currentStep.question)}
                  type="text"
                  placeholder="Enter answer here"
                  className="w-full p-2 border rounded-md border-slate-300 mb-2"
                />
              )}

              {currentStep?.type === 'single-variant' && (
                <>
                  {currentStep.options?.length ? (
                    currentStep.options.map((option, index) => (
                      <label
                        key={index}
                        className="block mb-4 p-4 shadow-sm bg-white rounded-lg cursor-pointer"
                        htmlFor={option}
                      >
                        <input {...register(currentStep.question)} type="radio" value={option} id={option} />
                        <span className="text-slate-700 font-bold ml-2">{option}</span>
                      </label>
                    ))
                  ) : (
                    <>
                      <label
                        className="block mb-4 p-4 shadow-sm bg-white rounded-lg cursor-pointer"
                        htmlFor={`${currentStep.id}-true`}
                      >
                        <input
                          {...register(currentStep.question)}
                          type="radio"
                          value={'true'}
                          id={`${currentStep.id}-true`}
                        />
                        <span className="text-slate-700 font-bold ml-2">Yes</span>
                      </label>
                      <label
                        className="block mb-4 p-4 shadow-sm bg-white rounded-lg cursor-pointer"
                        htmlFor={`${currentStep.id}-false`}
                      >
                        <input
                          {...register(currentStep.question)}
                          type="radio"
                          value={'false'}
                          id={`${currentStep.id}-false`}
                        />
                        <span className="text-slate-700 font-bold ml-2">No</span>
                      </label>
                    </>
                  )}
                </>
              )}

              {currentStep?.type === 'select-sex' && (
                <>
                  <label
                    className={
                      'inline-block w-1/2 text-center text-9xl text-indigo-500 hover:text-indigo-600 cursor-pointer py-4' +
                      (formData[currentStep.question] === 'male' ? ' border-2 border-indigo-500' : '')
                    }
                    htmlFor="male"
                    onClick={() => {
                      setValue(currentStep.question, 'male');
                      handleStep();
                    }}
                  >
                    <input
                      {...register(currentStep.question)}
                      type="radio"
                      value="male"
                      id="male"
                      className="invisible"
                    />
                    <FaMale className="inline" />
                  </label>
                  <label
                    className={
                      'inline-block w-1/2 text-center text-9xl text-pink-500 hover:text-pink-600 cursor-pointer py-4' +
                      (formData[currentStep.question] === 'female' ? ' border-2 border-pink-500' : '')
                    }
                    htmlFor="female"
                    onClick={() => {
                      setValue(currentStep.question, 'female');
                      handleStep();
                    }}
                  >
                    <input
                      {...register(currentStep.question)}
                      type="radio"
                      value="female"
                      id="female"
                      className="invisible"
                    />
                    <FaFemale className="inline" />
                  </label>
                </>
              )}

              {currentStep?.type === 'select-vehicle-type' && (
                <>
                  <label
                    className={
                      'inline-block w-1/2 text-center text-9xl text-indigo-500 hover:text-indigo-600 cursor-pointer py-4' +
                      (formData[currentStep.question] === 'car' ? ' border-2 border-indigo-500' : '')
                    }
                    htmlFor="car"
                    onClick={() => {
                      setValue(currentStep.question, 'car');
                      handleStep();
                    }}
                  >
                    <input
                      {...register(currentStep.question)}
                      type="radio"
                      value="car"
                      id="car"
                      className="invisible"
                    />
                    <FaCar className="inline" />
                  </label>
                  <label
                    className={
                      'inline-block w-1/2 text-center text-9xl text-yellow-500 hover:text-yellow-600 cursor-pointer py-4' +
                      (formData[currentStep.question] === 'bike' ? ' border-2 border-yellow-500' : '')
                    }
                    htmlFor="bike"
                    onClick={() => {
                      setValue(currentStep.question, 'bike');
                      handleStep();
                    }}
                  >
                    <input
                      {...register(currentStep.question)}
                      type="radio"
                      value="bike"
                      id="bike"
                      className="invisible"
                    />
                    <MdPedalBike className="inline" />
                  </label>
                </>
              )}

              {!currentStep?.additionalOptions?.hideNextButton && (
                <button
                  className="w-full bg-indigo-500 text-white py-2 rounded-lg hover:bg-indigo-600 transition-colors disabled:bg-slate-400"
                  onClick={handleNextButton}
                  disabled={isNextDisabled}
                >
                  Next
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </>
  );
};

export default App;
