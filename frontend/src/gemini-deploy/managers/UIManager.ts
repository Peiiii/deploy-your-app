export class UIManager {
  navigateTo = (view: string) => {
    console.warn(
      'UIManager.navigateTo is deprecated. Navigation is now handled by react-router.',
      view,
    );
  };

  getCurrentView = () => {
    console.warn(
      'UIManager.getCurrentView is deprecated. View state is now derived from the router.',
    );
    return 'explore';
  };

  openProject = (id: string) => {
    console.warn(
      'UIManager.openProject is deprecated. Use react-router navigation to /projects/:id instead.',
      id,
    );
  };
}
