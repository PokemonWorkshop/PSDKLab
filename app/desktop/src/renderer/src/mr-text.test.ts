import { describe, expect, it } from 'vitest';
import { absolute, gitlabAttributes } from './components/Markdown';
import { instructions, mrBody, summary } from './mr-text';

// The PSDK MR template, filled like a real MR.
const MR = `Thank you for your contribution to the **PSDK** repo.

Before submitting this Merge Request into the development branch, please make sure:
- [x] Your code runs clean without any errors or warnings
- [x] You tested your code to make sure it does what it is supposed to do

### MR Description

- Replaces the original F9 debugger with a new in-game debug menu for maps.

### Before testing

- Launch a project in debug mode.

### Notes to acknowledge before testing

- Development only.

### Tests to realize

- [x] F9 opens and closes the menu
- [ ] Nothing happens in a release build

<!-- if appliable !-->
### Showcasing content
![image](/uploads/a5311d72/image.png){width=478 height=384}

<!-- Do not remove this action !-->
/label ~"Need to be tested"
`;

describe('MR description', () => {
  it('keeps every section, apart from the template opening, without quick actions', () => {
    const { intro, body } = mrBody(MR);
    expect(intro).toMatch(/^Thank you for your contribution/);
    expect(intro).toContain('- [x] Your code runs clean');
    expect(body.startsWith('### MR Description')).toBe(true);
    for (const title of ['Before testing', 'Notes to acknowledge before testing', 'Tests to realize', 'Showcasing content'])
      expect(body).toContain(`### ${title}`);
    expect(body).not.toContain('/label');
    expect(body).not.toContain('<!--');
  });

  it('takes the tests from “Tests to realize”, not from “Before testing”', () => {
    const how = instructions(MR);
    expect(how.section).toBe(true);
    expect(how.markdown).toBe('- [x] F9 opens and closes the menu\n- [ ] Nothing happens in a release build');
  });

  it('summarises with the MR description, not the template thanks', () => {
    expect(summary(MR)).toBe('Replaces the original F9 debugger with a new in-game debug menu for maps.');
  });

  it('leaves a description without the template as it is', () => {
    expect(mrBody('Fixes #12.\n\n## How to test\n- Open the bag')).toEqual({
      intro: '',
      body: 'Fixes #12.\n\n## How to test\n- Open the bag',
    });
  });

  it('keeps quick-action-like lines inside code blocks', () => {
    expect(mrBody('```\n/label x\n```').body).toBe('```\n/label x\n```');
  });

  it('points uploads to the project id, as GitLab serves them', () => {
    expect(absolute('/uploads/a5311d72/image.png', 7677638)).toBe(
      'https://gitlab.com/-/project/7677638/uploads/a5311d72/image.png',
    );
    expect(absolute('https://example.org/x.png', 7677638)).toBe('https://example.org/x.png');
  });

  it('reads GitLab image sizes', () => {
    expect(gitlabAttributes('![image](/uploads/a/image.png){width=478 height=384}')).toBe(
      '![image](/uploads/a/image.png#psdk-size=478x384)',
    );
    expect(gitlabAttributes('![v](/uploads/a/v.mp4)')).toBe('![v](/uploads/a/v.mp4)');
  });
});
