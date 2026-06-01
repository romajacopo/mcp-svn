/**
 * Shared fixtures for the "red build" scenario.
 *
 * Two files in a tiny Maven project:
 *   - Calculator (com.example.math)      — owned/changed by "bob"
 *   - MathService (com.example.service)  — calls Calculator.add(), owned by "alice"
 *
 * The bug: in r2 "bob" renames Calculator.add -> Calculator.addUp.
 * MathService still calls add() -> compile error in MathService, but the
 * ROOT CAUSE is Calculator (changed by bob). That mismatch is the whole point.
 */

export const CALC_PATH = "src/main/java/com/example/math/Calculator.java";
export const SVC_PATH = "src/main/java/com/example/service/MathService.java";

export const CALCULATOR_V1 = `package com.example.math;

public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }
}
`;

/** bob's breaking change: add() renamed to addUp(). */
export const CALCULATOR_V2_BUG = `package com.example.math;

public class Calculator {
    public int addUp(int a, int b) {
        return a + b;
    }
}
`;

export const MATH_SERVICE = `package com.example.service;

import com.example.math.Calculator;

public class MathService {
    private final Calculator calculator = new Calculator();

    public int sum(int a, int b) {
        return calculator.add(a, b);
    }
}
`;

/** Realistic maven-compiler-plugin failure pointing at MathService.java line 9. */
export const MAVEN_FAILURE_LOG = `[INFO] Scanning for projects...
[INFO] Building math-app 1.0.0
[INFO] --- maven-compiler-plugin:3.11.0:compile (default-compile) @ math-app ---
[INFO] Compiling 2 source files to /workspace/target/classes
[ERROR] /workspace/${SVC_PATH}:[9,27] cannot find symbol
[ERROR]   symbol:   method add(int,int)
[ERROR]   location: variable calculator of type com.example.math.Calculator
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
[ERROR] Failed to execute goal org.apache.maven.plugins:maven-compiler-plugin:3.11.0:compile
`;
