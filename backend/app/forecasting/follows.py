from sqlalchemy.orm import Session



from app.forecasting.models import Agent, Follow, User, UserProfile





def followed_agent_ids(user: User | None, db: Session) -> set[int]:

    if user is None:

        return set()

    rows = (

        db.query(Follow.agent_id)

        .filter(Follow.follower_user_id == user.id)

        .all()

    )

    return {row[0] for row in rows}





def is_following_agent(agent_id: int, user: User | None, db: Session) -> bool:

    if user is None:

        return False

    return (

        db.query(Follow)

        .filter(

            Follow.follower_user_id == user.id,

            Follow.agent_id == agent_id,

        )

        .first()

        is not None

    )





def anchor_agent_id(user: User | None, db: Session) -> int | None:

    from app.forecasting.services.anchor_agent import resolve_anchor_agent_id



    return resolve_anchor_agent_id(user, db)





def is_anchor_agent(agent_id: int, user: User | None, db: Session) -> bool:

    resolved = anchor_agent_id(user, db)

    return resolved is not None and resolved == agent_id

