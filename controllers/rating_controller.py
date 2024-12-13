# from flask import jsonify, request, Blueprint
# from models.rating import Rating
# from models.users import User
# from models.products import Product
# from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
# from connector.db import db


# rating_bp = Blueprint('rating_controller'__name__)


# @rating_bp.route('/getallrating', methods=['GET'])
# def get_all_rating():
#     try:
#         ratings = db.session.query(Rating).all()

#         return jsonify([rating.to_dict() for rating in ratings]), 200
#     except Exception as e:
#         return jsonify({'error': 'Failed to get rating'}), 500