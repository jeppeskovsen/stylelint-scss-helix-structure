
import _ from "lodash"
import stylelint, { LinterOptions, RuleTesterSchema, RuleTesterTest, RuleTesterTestRejected, Configuration } from "stylelint"

interface CustomRuleTesterTest extends RuleTesterTest {
  codeFilename: string
}

interface CustomRuleTesterTestRejected extends RuleTesterTestRejected, CustomRuleTesterTest {
  fixed?: string
}

interface CustomRuleTesterSchema extends RuleTesterSchema {
  accept?: CustomRuleTesterTest[]
  reject?: CustomRuleTesterTestRejected[]
  fix?: boolean
}

export const testRule = (testSchema: CustomRuleTesterSchema) => {
  const schema: CustomRuleTesterSchema = {
    config: [true],
    syntax: "scss",
    ...testSchema
  }

  describe(`${schema.ruleName}`, () => {
    const stylelintConfig: Partial<Configuration> = {
      plugins: ["./lib"],
      rules: {
        [schema.ruleName]: schema.config
      }
    }
  
    if (schema.accept && schema.accept.length) {
      describe("accept", () => {
        schema.accept.forEach(testCase => {
          it(testCase.description || "no description", () => {
            const options: Partial<LinterOptions> = {
              code: testCase.code,
              codeFilename: testCase.codeFilename,
              config: stylelintConfig,
              syntax: schema.syntax
            }

            return stylelint.lint(options).then(output => {
              expect(output.results[0].warnings).toEqual([])
  
              if (!schema.fix) {
                return
              }
  
              // Check the fix
              return stylelint
                .lint(Object.assign({ fix: true }, options))
                .then(output2 => {
                  const fixedCode = getOutputCss(output2)
  
                  expect(fixedCode).toBe(testCase.code)
                })
            })
          })
        })
      })
    }
  
    if (schema.reject && schema.reject.length) {
      describe("reject", () => {
        schema.reject.forEach(testCase => {
          const spec = testCase.only ? it.only : it;
  
          spec(testCase.description || "no description", () => {
            const options: Partial<LinterOptions> = {
              code: testCase.code,
              codeFilename: testCase.codeFilename,
              config: stylelintConfig,
              syntax: schema.syntax
            }
  
            return stylelint.lint(options).then(output => {
              const warnings = output.results[0].warnings
              const warning = warnings[0]
  
              expect(warnings.length).toBeGreaterThanOrEqual(1)

              if (testCase.message !== undefined) {
                expect(_.get(warning, "text")).toBe(testCase.message)
              }
  
              if (testCase.line !== undefined) {
                expect(_.get(warning, "line")).toBe(testCase.line)
              }
  
              if (testCase.column !== undefined) {
                expect(_.get(warning, "column")).toBe(testCase.column)
              }
  
              if (!schema.fix) {
                return
              }
  
              if (!testCase.fixed) {
                throw new Error("If using { fix: true } in test schema, all reject cases must have { fixed: .. }")
              }
  
              // Check the fix
              return stylelint
                .lint(Object.assign({ fix: true }, options))
                .then(output2 => {
                  const fixedCode = getOutputCss(output2)
                  expect(fixedCode).toBe(testCase.fixed)
                })
            })
          })
        })
      })
    }
  })
}

function getOutputCss(output) {
  const result = output.results[0]._postcssResult
  const css = result.root.toString(result.opts.syntax)

  return css
}

export const testConfig = input => {
  let testFn

  if (input.only) {
    testFn = test.only
  } else if (input.skip) {
    testFn = test.skip
  } else {
    testFn = test
  }

  testFn(input.description, () => {
    const config = {
      plugins: ["./"],
      rules: {
        [input.ruleName]: input.config
      }
    }

    return stylelint
      .lint({
        code: "",
        config
      })
      .then(data => {
        const invalidOptionWarnings = data.results[0].invalidOptionWarnings

        if (input.valid) {
          expect(invalidOptionWarnings).toHaveLength(0)
        } else {
          expect(invalidOptionWarnings[0].text).toBe(input.message)
        }
      })
  })
}
